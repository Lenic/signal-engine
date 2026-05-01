import { Subscriber } from './subscriber';
import { Scheduler } from './scheduler';

/**
 * Represents a side effect that automatically runs when its dependencies change.
 */
export class Effect extends Subscriber {
  /** The callback function containing the side effect logic. */
  private _task: () => void;

  /**
   * Creates a new reactive effect and executes it immediately to track dependencies.
   *
   * @param task - The function containing the effect logic.
   */
  constructor(task: () => void) {
    super();
    this._task = task;
    this.run();
  }

  /**
   * Executes the effect, manages tracking indices, and cleans up stale subscriptions.
   */
  public run(): void {
    if (!this.active) return;

    // Stop and clear child effects before re-running
    for (const child of this.children) {
      child.stop();
    }
    this.children = [];

    this.trackingIndex = 0;
    
    // Execute the task within this subscriber's context
    Scheduler.runWithSubscriber(this, this._task);

    // Cleanup unused subscriptions after the run
    if (this.trackingIndex < this.subscriptions.length) {
      for (let i = this.trackingIndex; i < this.subscriptions.length; i++) {
        const node = this.subscriptions[i];
        if (node.list) {
          node.list.remove(node);
        }
      }
      this.subscriptions.length = this.trackingIndex;
    }
  }
}
