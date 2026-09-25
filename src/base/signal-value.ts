import type { ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IDirtyMarkable, ISignalValue, IValueOptions } from './types';

import { addChangeListener, notifyListeners } from './change-listener';
import { globalContext } from './global-context';

export class SignalValue<T> implements ISignalValue<T> {
  private _value: T;
  private _name?: string;
  private _version: number;
  private _hasBeenRead: boolean;
  private _comparer?: IAction<[T, T], boolean>;

  /** @internal */
  _listeners?: ILinkedList<IDirtyMarkable> | undefined;

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

  flush(): void {
    notifyListeners(this);
  }

  addChangeListener(listener: IDirtyMarkable): ILinkedNode<IDirtyMarkable> {
    return addChangeListener(this, listener);
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

  private equal(target: T): boolean {
    if (Object.is(this._value, target)) return true;
    if (!this._comparer) return false;

    return this._comparer(this._value, target);
  }
}
