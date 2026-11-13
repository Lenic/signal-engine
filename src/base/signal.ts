import type { IAction, IBatchSnapshot, IConnector, IRunnable, ISignalValue, IValueOptions } from './types';

import { BatchScope } from './batch';
import { globalContext } from './context';
import { getClock, notifyDirty } from './utils';

export class SignalValue<T> implements ISignalValue<T> {
  private _value: T;
  private _name?: string;
  private _version: number;
  private _hasBeenRead: boolean;
  private _isQueuedForBatchResume: boolean;
  private _comparer?: IAction<[T, T], boolean>;

  lastRunId?: number;
  lastRunnable?: IRunnable;

  runnableHead?: IConnector;
  runnableTail?: IConnector;

  constructor(value: T, options?: IValueOptions<T>) {
    this.lastRunId = undefined;
    this.lastRunnable = undefined;
    this.runnableHead = undefined;
    this.runnableTail = undefined;

    this._isQueuedForBatchResume = false;

    this._version = 0;
    this._value = value;
    this._hasBeenRead = false;

    this._name = options?.name;
    this._comparer = options?.comparer;
  }

  get isDisposed(): boolean {
    return false;
  }

  dispose(): void {
    let node = this.runnableHead;
    while (node) {
      node.dispose();
      node = this.runnableHead;
    }
  }

  get name(): string | undefined {
    return this._name;
  }

  get value(): T {
    this._hasBeenRead = true;
    globalContext.track(this, this._version);

    return this._value;
  }

  get version(): number {
    return this._version;
  }

  setValue(newValue: T, force?: boolean): void {
    if (force || !this.equal(newValue)) {
      this.addBatchSnapshot();

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
        notifyDirty(this.runnableHead);
      }
    }
  }

  private addBatchSnapshot() {
    if (BatchScope.isBatching && !this._isQueuedForBatchResume) {
      globalContext.batchSnapshots.push({
        instance: this as SignalValue<unknown>,
        version: this._version,
        value: this._value,
        hasBeenRead: this._hasBeenRead,
      });
      this._isQueuedForBatchResume = true;
    }
  }

  private equal(target: T): boolean {
    if (Object.is(this._value, target)) return true;
    if (!this._comparer) return false;

    return this._comparer(this._value, target);
  }

  static restoreFromBatch({ instance, value, version, hasBeenRead }: IBatchSnapshot) {
    const target = instance as SignalValue<unknown>;

    target._isQueuedForBatchResume = false;
    if (target.equal(value)) {
      target._value = value;
      target._version = version;
      target._hasBeenRead = hasBeenRead;
    }
  }
}
