import { IDependencyNode, IObservable, ISubscriber, NodeStatus } from './types';
import { DependencyNode } from './dependency';
import { Scheduler } from './scheduler';

/**
 * Base class for reactive data sources. It manages a doubly linked list of subscribers.
 */
export class Observable implements IObservable {
  /** The first node in the doubly linked list of subscriptions. */
  public head: IDependencyNode | null = null;

  /** The last node in the doubly linked list of subscriptions. */
  public tail: IDependencyNode | null = null;

  /**
   * The topological rank of this data source.
   * Signals typically have a rank of 0, while Memos inherit the rank of their upstreams.
   */
  public rank: number = 0;

  /** The subscriber that owns this observable. */
  public owner: ISubscriber | null = null;

  /**
   * Tracks the currently active subscriber as a dependency.
   */
  public track(): void {
    if (!Scheduler.activeSubscriber) return;

    const subscriber = Scheduler.activeSubscriber;
    const index = subscriber.trackingIndex++;

    // 🚀 RANK PROPAGATION:
    // Ensure the subscriber's rank is strictly greater than its dependency's rank.
    // Use updateRank to propagate changes through the topological graph.
    if (subscriber.rank <= this.rank) {
      subscriber.updateRank(this.rank + 1);
    }

    // 🚀 REUSE OPTIMIZATION:
    // If the dependency at this index is the same, reuse it to avoid object instantiation.
    if (subscriber.subscriptions[index]?.list === this) {
      return;
    }

    const newNode = new DependencyNode(subscriber, this);

    // If there was an old node at this index, remove it first
    if (subscriber.subscriptions[index]) {
      const oldNode = subscriber.subscriptions[index];
      if (oldNode.list) {
        oldNode.list.remove(oldNode);
      }
      subscriber.subscriptions[index] = newNode;
    } else {
      subscriber.subscriptions.push(newNode);
    }

    this.append(newNode);
  }

  /**
   * Triggers updates for all registered subscribers.
   *
   * @param isDirectChange - Whether this trigger is caused by a direct value change (Signal) or an indirect one (Memo).
   */
  public trigger(isDirectChange: boolean = true): void {
    Scheduler.batch(() => {
      let current = this.head;
      while (current) {
        const next = current.next;
        const subscriber = current.subscriber;
        if (subscriber) {
          const newStatus = isDirectChange ? NodeStatus.STALE : NodeStatus.CHECK;

          // Only update status and notify downstream if the new status is "dirtier" than current
          if (subscriber.status < newStatus) {
            subscriber.status = newStatus;
            subscriber.notifyDownstream(newStatus);
            subscriber.requestUpdate();
          }
        }
        current = next;
      }
    });
  }

  /**
   * Appends a dependency node to the end of the linked list.
   *
   * @param node - The dependency node to append.
   */
  private append(node: IDependencyNode): void {
    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      if (this.tail) {
        this.tail.next = node;
      }
      node.prev = this.tail;
      this.tail = node;
    }
  }

  /**
   * Removes a dependency node from the linked list.
   *
   * @param node - The dependency node to remove.
   */
  public remove(node: IDependencyNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next; // Node was head
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev; // Node was tail
    }

    // Clear node links
    node.prev = null;
    node.next = null;
    node.list = null;
    node.subscriber = null;
  }
}
