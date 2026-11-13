import type { IAction, IConnector, IMemoValue, IRunnable, IValueOptions } from './types';

import { globalContext } from './context';
import { Runnable } from './runnable';
import { notifyDirty } from './utils';

const defaultValue = Symbol('default_memo_value');

export class MemoValue<T> extends Runnable<MemoValue<T>> implements IMemoValue<T> {
  private _version: number;
  private _hasBeenRead: boolean;
  private _getter: IAction<[], T>;
  private _value: T | typeof defaultValue;
  private _comparer?: IAction<[T, T], boolean>;

  lastRunId?: number;
  lastRunnable?: IRunnable;

  runnableHead?: IConnector;
  runnableTail?: IConnector;

  constructor(getter: IAction<[], T>, options?: IValueOptions<T>) {
    super(options?.name);

    this.lastRunId = undefined;
    this.lastRunnable = undefined;
    this.runnableHead = undefined;
    this.runnableTail = undefined;

    this._version = 0;
    this._hasBeenRead = false;
    this._value = defaultValue;

    this._getter = getter;
    this._comparer = options?.comparer;
  }

  get value(): T {
    this.refreshValue();
    if (this._value === defaultValue) {
      throw new Error('[MemoValue]: must return value from getter() method');
    }

    globalContext.track(this);
    return this._value;
  }

  get version(): number {
    if (this._hasBeenRead) return this._version;

    this.refreshValue();
    return this._version;
  }

  markDirty(): IConnector | undefined {
    if (!this._hasBeenRead || this.isDisposed) return;
    this._hasBeenRead = false;

    return this.runnableHead;
  }

  disposeWithErrorContext(): void {
    this._getter = undefined as unknown as IAction<[], T>;

    let node1 = this.connectibleHead;
    while (node1) {
      node1.dispose();
      node1 = this.connectibleHead;
    }

    let node2 = this.runnableHead;
    while (node2) {
      node2.dispose();
      node2 = this.runnableHead;
    }
  }

  private refreshValue() {
    if (this._hasBeenRead || this.isDisposed) return;

    this._hasBeenRead = true;
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
