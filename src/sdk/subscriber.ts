import { IDependencyNode, ISubscriber, NodeStatus } from './types';
import { Scheduler } from './scheduler';

/**
 * Base abstract class representing a reactive consumer that observes changes.
 */
export abstract class Subscriber implements ISubscriber {
  /** The topological rank of this subscriber. */
  public rank: number = 0;

  /** Indicates whether the subscriber is currently active and listening. */
  public active: boolean = true;

  /** The index used to reuse dependency nodes during tracking. */
  public trackingIndex: number = 0;

  /** The list of dependency nodes this subscriber is tracking. */
  public subscriptions: IDependencyNode[] = [];

  /** The nested subscribers created within this subscriber's context. */
  public children: ISubscriber[] = [];

  /** The parent subscriber, if this subscriber was created within another context. */
  public parent: ISubscriber | null = null;

  /** The current status of the subscriber within the reactivity system. */
  public status: NodeStatus = NodeStatus.CLEAN;

  /** Indicates whether the subscriber is currently in its update lifecycle. */
  public isUpdating: boolean = false;

  /** Indicates whether this subscriber is currently in the execution queue. */
  public isQueued: boolean = false;

  /** Pointer to the next subscriber in the scheduler's queue. */
  public nextScheduled: ISubscriber | null = null;

  constructor() {
    this.parent = Scheduler.activeSubscriber;
    if (this.parent) {
      this.parent.children.push(this);
    }
  }

  /**
   * Executes the reactive logic for this subscriber. Must be implemented by subclasses.
   */
  public abstract run(): void;

  /**
   * Ensures the subscriber is up to date by checking its status and polling dependencies if necessary.
   */
  public maybeUpdate(): void {
    if (this.status === NodeStatus.CLEAN) return;

    this.isUpdating = true;
    try {
      if (this.status === NodeStatus.CHECK) {
        // Poll upstream dependencies to see if any have actually changed
        for (const node of this.subscriptions) {
          const owner = node.list.owner;
          if (owner) {
            // 🚀 OPTIMIZATION: If the dependency is a child and is dirty, just mark ourselves as STALE.
            // No need to poll the child because we will dispose of it when we re-run anyway.
            if (this.children.includes(owner) && owner.status !== NodeStatus.CLEAN) {
              this.status = NodeStatus.STALE;
            } else {
              owner.maybeUpdate();
            }
          }
        }
      }

      if (this.status === NodeStatus.STALE) {
        // Reset status to CLEAN before running to allow circular triggers to re-mark it as STALE
        this.status = NodeStatus.CLEAN;
        this.run();
      } else {
        this.status = NodeStatus.CLEAN;
      }
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Notifies downstream subscribers about a status change.
   * Default implementation does nothing; overridden by Memo to propagate CHECK status.
   *
   * @param status - The new status of this subscriber.
   */
  public notifyDownstream(status: NodeStatus): void {}

  /**
   * Requests an update from the scheduler.
   * Default implementation does nothing; overridden by Effect to schedule itself.
   */
  public requestUpdate(): void {}

  /**
   * Cleans up all existing subscriptions and stops all child subscribers.
   */
  protected cleanup(): void {
    for (const node of this.subscriptions) {
      if (node.list) {
        node.list.remove(node);
      }
    }
    this.subscriptions = [];

    // Stop and clear child effects
    for (const child of this.children) {
      child.stop();
    }
    this.children = [];
  }

  /**
   * Permanently stops the subscriber from reacting to further updates.
   */
  public stop(): void {
    if (!this.active) return;
    this.active = false;
    this.cleanup();
  }

  /**
   * Cleans up stale subscriptions from the tracking list.
   * Called internally after `run` or `value` getter evaluation.
   */
  protected finalizeTracking(): void {
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

  /**
   * Updates the rank of the subscriber.
   *
   * @param newRank - The new topological rank.
   */
  public updateRank(newRank: number): void {
    this.rank = newRank;
  }
}
