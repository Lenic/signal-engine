import { Subscriber } from './subscriber';
import { Scheduler } from './scheduler';
import { NodeStatus } from './types';

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
    // Effects start as STALE to ensure they run immediately
    this.status = NodeStatus.STALE;
    this.maybeUpdate();
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
    this.finalizeTracking();
  }

  /**
   * Requests the scheduler to execute this effect.
   */
  public override requestUpdate(): void {
    // 🚀 OPTIMIZATION:
    // If the effect is already in its update lifecycle (polling), we don't need to re-schedule
    // it because the current maybeUpdate call will eventually run it if it becomes STALE.
    // However, if the trigger happens DURING the run (circular), we MUST schedule it.
    if (!this.isUpdating || Scheduler.activeSubscriber === this) {
      Scheduler.scheduleUpdate(this);
    }
  }
}
