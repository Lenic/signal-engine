import type { ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IDirtyMarkable, IMemoValue, IValueOptions } from './types';

import { ErrorScope } from '../utils';

import { addChangeListener, notifyListeners } from './change-listener';
import { globalContext } from './global-context';
import { Runnable } from './runnable';

const defaultValue = Symbol('default_memo_value');

export class MemoValue<T> extends Runnable implements IMemoValue<T> {
  private _name?: string;
  private _version: number;
  private _hasBeenRead: boolean;
  private _getter: IAction<[], T>;
  private _value: T | typeof defaultValue;
  private _comparer?: IAction<[T, T], boolean>;

  /** @internal */
  _listeners?: ILinkedList<IDirtyMarkable> | undefined;

  constructor(getter: IAction<[], T>, options?: IValueOptions<T>) {
    super();

    this._version = 0;
    this._hasBeenRead = false;
    this._value = defaultValue;

    this._getter = getter;
    this._name = options?.name;
    this._comparer = options?.comparer;
  }

  get name(): string | undefined {
    return this._name;
  }

  get value(): T {
    this.refreshValue();
    if (this._value === defaultValue) {
      throw new Error('[MemoValue]: must return value from getter() method');
    }

    this._hasBeenRead = true;
    globalContext.track(this);

    return this._value;
  }

  get version(): number {
    if (this._hasBeenRead) return this._version;

    this.refreshValue();
    return this._version;
  }

  get listeners(): ILinkedList<IDirtyMarkable> | undefined {
    return this._listeners;
  }

  notifyListeners(): void {
    notifyListeners(this);
  }

  addChangeListener(listener: IDirtyMarkable): ILinkedNode<IDirtyMarkable> {
    return addChangeListener(this, listener);
  }

  markDirty(): void {
    if (!this._hasBeenRead) return;

    try {
      const ctx = ErrorScope.begin();
      let node = this._listeners?.head;
      while (node) {
        try {
          node.value.markDirty();
        } catch (e) {
          ctx.push(e);
        }
        node = node.next;
      }
      ErrorScope.end(ctx);
    } finally {
      this._hasBeenRead = false;
    }
  }

  private refreshValue() {
    if (this._hasBeenRead) return;

    const newValue = this.execute(this._getter, defaultValue);
    if (newValue !== defaultValue && !this.equal(newValue)) {
      this._value = newValue;
      this._version += 1;
    }
  }

  private equal(target: T): boolean {
    if (Object.is(this._value, target)) return true;
    if (!this._comparer) return false;
    if (this._value === defaultValue) return false;

    return this._comparer(this._value, target);
  }
}
