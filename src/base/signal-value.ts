import type { ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IDirtyMarkable, ISignalValue, ISignalValueOptions } from './types';

import { ErrorScope, LinkedList } from '../utils';

export class SignalValue<T, TListener extends IDirtyMarkable> implements ISignalValue<T, TListener> {
  private _value: T;
  private _name?: string;
  private _version: number;
  private _hasBeenRead: boolean;
  private _comparer?: IAction<[T, T], boolean>;
  private _listeners?: ILinkedList<TListener> | undefined;

  constructor(value: T, options?: ISignalValueOptions<T>) {
    this._hasBeenRead = false;

    this._version = 0;
    this._value = value;
    this._name = options?.name;
  }

  get name(): string | undefined {
    return this._name;
  }

  get value(): T {
    this._hasBeenRead = true;
    return this._value;
  }

  get version(): number {
    return this._version;
  }

  get listeners(): ILinkedList<TListener> | undefined {
    return this._listeners;
  }

  flush(): void {
    let node = this._listeners?.head;
    if (!node) return;

    const ctx = ErrorScope.begin();

    while (node) {
      try {
        node.value.markDirty();
      } catch (e) {
        ctx.push(e);
      }
      node = node.next;
    }
    ErrorScope.end(ctx);
  }

  setValue(newValue: T, force?: boolean): void {
    if (force || !this.equal(newValue)) {
      this._version += 1;
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
        this.flush();
      }
    }
  }

  addChangeListener(listener: TListener): ILinkedNode<TListener> {
    return this.bus.append(listener);
  }

  private get bus(): ILinkedList<TListener> {
    let bus = this._listeners;
    if (!bus) {
      this._listeners = bus = new LinkedList<TListener>();
    }
    return bus;
  }

  private equal(target: T): boolean {
    if (Object.is(this._value, target)) return true;
    if (!this._comparer) return false;

    return this._comparer(this._value, target);
  }
}
