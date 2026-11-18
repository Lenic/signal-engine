import type { IAction, IConnector, IMemoValue, IRunnable, IValueOptions, TMarkableDirtyType } from './types';

import { globalContext } from './context';
import { Runnable } from './runnable';
import { DIRTY_TYPE_CLEAN } from './types';

const defaultValue = Symbol('default_memo_value');

export class MemoValue<T> extends Runnable<MemoValue<T>> implements IMemoValue<T> {
  private _version: number;
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
    this._value = defaultValue;

    this._getter = getter;
    this._comparer = options?.comparer;
  }

  get value(): T {
    this.refresh();
    if (this._value === defaultValue) {
      throw new Error('[MemoValue]: must return value from getter() method');
    }

    if (!this.isDisposed) {
      globalContext.track(this, this._version);
    }
    return this._value;
  }

  get version(): number {
    if (this.dirtyType === DIRTY_TYPE_CLEAN) return this._version;

    this.refresh();
    return this._version;
  }

  markDirty(dirtyType: TMarkableDirtyType): IConnector | undefined {
    if (this.dirtyType === dirtyType || this.isDisposed) return;

    const originalDirtyType = this.dirtyType;
    this.dirtyType = dirtyType;

    return originalDirtyType === DIRTY_TYPE_CLEAN ? this.runnableHead : undefined;
  }

  disposeWithErrorContext(): void {
    this.dirtyType = DIRTY_TYPE_CLEAN;
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

  private refresh(): void {
    if (!this.shoudRun()) return;

    const newValue = this.execute(this._getter);
    if (!this.equal(newValue)) {
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
