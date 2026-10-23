import type { ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IBatchSnapshot, IDirtyMarkable, ISignalValue, IValueOptions } from './types';

import { BatchScope, LinkedList } from '../utils';

import { globalContext } from './global-context';
import { getClock, notifyListeners } from './utils';

export class SignalValue<T> implements ISignalValue<T> {
  private _value: T;
  private _name?: string;
  private _version: number;
  private _hasBeenRead: boolean;
  private _comparer?: IAction<[T, T], boolean>;
  private _listeners?: ILinkedList<IDirtyMarkable>;
  private _batchQueueNode?: ILinkedNode<IBatchSnapshot>;

  constructor(value: T, options?: IValueOptions<T>) {
    this._version = 0;
    this._value = value;
    this._hasBeenRead = false;

    this._name = options?.name;
    this._comparer = options?.comparer;
  }

  get name(): string | undefined {
    return this._name;
  }

  get value(): T {
    this._hasBeenRead = true;
    globalContext.track(this);

    return this._value;
  }

  get version(): number {
    return this._version;
  }

  get listeners(): ILinkedList<IDirtyMarkable> | undefined {
    return this._listeners;
  }

  addChangeListener(listener: IDirtyMarkable): ILinkedNode<IDirtyMarkable> {
    return (this._listeners ??= new LinkedList<IDirtyMarkable>()).append(listener);
  }

  setValue(newValue: T, force?: boolean): void {
    if (force || !this.equal(newValue)) {
      if (BatchScope.isBatching && !this._batchQueueNode) {
        this._batchQueueNode = globalContext.batchSnapshots.append({
          instance: this as SignalValue<unknown>,
          version: this._version,
          value: this._value,
          hasBeenRead: this._hasBeenRead,
        });
        this._batchQueueNode.onBeforeClear = SignalValue.releaseFromBatch;
      }

      this._version = getClock();
      this._value = newValue;

      /**
       * The notification should be published only once after the new value is set.
       *
       * - The value should mark as read after the value is read.
       * - The value should mark as unread after a new value is set.
       * - If the value has not been read, the notification should not be published again when a new value is set.
       */
      if (this._hasBeenRead) {
        this._hasBeenRead = false;
        notifyListeners(this._listeners, SignalValue.publish);
      }
    }
  }

  private equal(target: T): boolean {
    if (Object.is(this._value, target)) return true;
    if (!this._comparer) return false;

    return this._comparer(this._value, target);
  }

  private static publish(target: IDirtyMarkable) {
    target.markDirty();
  }

  private static releaseFromBatch(node: ILinkedNode<IBatchSnapshot>) {
    const { instance, value, version, hasBeenRead } = node.value;
    const target = instance as SignalValue<unknown>;

    target._batchQueueNode = undefined;
    if (target.equal(value)) {
      target._value = value;
      target._version = version;
      target._hasBeenRead = hasBeenRead;
    }
  }
}
