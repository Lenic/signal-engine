import { IDependencyNode, ISubscriber } from './types';
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
