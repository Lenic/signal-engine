import { Subscriber } from './subscriber';
import { Observable } from './observable';
import { Scheduler } from './scheduler';
import { NodeStatus } from './types';

const UNINITIALIZED = Symbol('UNINITIALIZED');

/**
 * Represents a computed reactive value that caches its result and only recalculates
 * when its upstream dependencies have changed.
 */
export class Memo<T> extends Subscriber {
  /** The function used to compute the memoized value. */
  private _task: () => T;

  /** The currently cached value. */
  private _cachedValue: T | typeof UNINITIALIZED = UNINITIALIZED;

  /** An internal observable used to manage downstream dependencies. */
  private _observable: Observable = new Observable();

  /**
   * Creates a new memoized computation.
   *
   * @param task - The computation function.
   */
  constructor(task: () => T) {
    super();
    this._task = task;
    this._observable.owner = this;
    // Memos start as STALE to ensure they run on the first access
    this.status = NodeStatus.STALE;
  }

  /**
   * Recalculates the memoized value and notifies downstream if the value has changed.
   */
  public run(): void {
    if (!this.active) return;

    const prevValue = this._cachedValue;
    this.trackingIndex = 0;

    // Execute the task and track dependencies
    this._cachedValue = Scheduler.runWithSubscriber(this, this._task);

    // Synchronize the dependency list rank with this subscriber's rank
    this._observable.rank = this.rank;

    // Cleanup unused subscriptions after recomputation
    this.finalizeTracking();

    // Value Stability Check: Only trigger downstream if the value actually changed
    if (prevValue === UNINITIALIZED || !Object.is(prevValue, this._cachedValue)) {
      this._observable.trigger(true);
    }
  }

  /**
   * Retrieves the computed value, ensuring it is up to date via the Push-Pull mechanism.
   */
  public get value(): T {
    // 🚀 PULL: Ensure the value is fresh before returning
    this.maybeUpdate();

    // Register the active subscriber as a dependency of this memo
    if (Scheduler.activeSubscriber) {
      this._observable.track();
    }

    return this._cachedValue as T;
  }

  /**
   * Notifies downstream subscribers that this memo's value might change.
   *
   * @param status - The new status of this memo.
   */
  public override notifyDownstream(status: NodeStatus): void {
    // Propagate a CHECK status to downstream to indicate a potential change
    this._observable.trigger(false);
  }

  /**
   * Recursively propagates rank updates downstream to maintain correct topological sorting.
   *
   * @param newRank - The new rank to assign to this memo and its observable.
   */
  public updateRank(newRank: number): void {
    if (this.rank < newRank) {
      this.rank = newRank;
      this._observable.rank = newRank;

      let current = this._observable.head;
      while (current) {
        if (current.subscriber && current.subscriber.rank <= newRank) {
          current.subscriber.updateRank(newRank + 1);
        }
        current = current.next;
      }
    }
  }
}
