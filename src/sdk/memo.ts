import { Subscriber } from './subscriber';
import { Observable } from './observable';
import { Scheduler } from './scheduler';

/**
 * Represents a computed reactive value that caches its result and only recalculates
 * when its upstream dependencies have changed.
 */
export class Memo<T> extends Subscriber {
  /** The function used to compute the memoized value. */
  private _task: () => T;

  /** The currently cached value. */
  private _cachedValue!: T;

  /** Indicates whether the cached value is stale and needs recomputation. */
  private _isDirty: boolean = true;

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
  }

  /**
   * Reacts to upstream changes by marking the memo as dirty and notifying downstream subscribers.
   */
  public run(): void {
    if (this._isDirty) return; // Already dirty, no need to re-trigger downstream
    this._isDirty = true;
    this._observable.trigger();
  }

  /**
   * Retrieves the computed value, recalculating it if dependencies have changed,
   * and registers the active subscriber as a dependency.
   */
  public get value(): T {
    this._observable.track();

    if (this._isDirty) {
      this.trackingIndex = 0;

      Scheduler.runWithSubscriber(this, () => {
        this._cachedValue = this._task();
      });

      // Synchronize the dependency list rank with this subscriber's rank
      this._observable.rank = this.rank;

      // Cleanup unused subscriptions after recomputation
      if (this.trackingIndex < this.subscriptions.length) {
        for (let i = this.trackingIndex; i < this.subscriptions.length; i++) {
          const node = this.subscriptions[i];
          if (node.list) {
            node.list.remove(node);
          }
        }
        this.subscriptions.length = this.trackingIndex;
      }

      this._isDirty = false;
    }

    return this._cachedValue;
  }
}
