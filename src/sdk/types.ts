/**
 * Represents the current state of a subscriber in the reactivity graph.
 */
export enum NodeStatus {
  /** The subscriber is up to date and does not need re-evaluation. */
  CLEAN = 0,
  /** One of the subscriber's upstream dependencies (via a Memo) might have changed. */
  CHECK = 1,
  /** The subscriber's direct dependencies have changed; it must be re-evaluated. */
  STALE = 2,
}

/**
 * Represents a reactive consumer that executes side effects or computes derived values.
 */
export interface ISubscriber {
  /** The topological rank of this subscriber. */
  rank: number;
  /** Indicates whether the subscriber is currently active and listening. */
  active: boolean;
  /** The index used to reuse dependency nodes during tracking. */
  trackingIndex: number;
  /** The list of dependency nodes this subscriber is tracking. */
  subscriptions: IDependencyNode[];
  /** The nested subscribers created within this subscriber's context. */
  children: ISubscriber[];
  /** The parent subscriber, if this subscriber was created within another context. */
  parent: ISubscriber | null;

  /** Indicates whether the subscriber is currently in its update lifecycle (polling or running). */
  isUpdating: boolean;

  /** The current status of the subscriber within the reactivity system. */
  status: NodeStatus;

  /** Indicates whether this subscriber is currently in the execution queue. */
  isQueued: boolean;
  /** Pointer to the next subscriber in the scheduler's queue (Intrusive Linked List). */
  nextScheduled: ISubscriber | null;

  /** Executes the reactive logic for this subscriber. */
  run(): void;
  /** Ensures the subscriber is up to date by checking its status and dependencies. */
  maybeUpdate(): void;
  /** Notifies downstream subscribers about a status change. */
  notifyDownstream(status: NodeStatus): void;
  /** Requests the scheduler to run this subscriber if it is a side effect. */
  requestUpdate(): void;
  /** Permanently stops the subscriber from reacting to further updates. */
  stop(): void;
  /** Updates the topological rank of this subscriber, potentially propagating it to downstream dependencies. */
  updateRank(newRank: number): void;
}

/**
 * Represents a data source that can be tracked by subscribers.
 */
export interface IObservable {
  /** The first node in the doubly linked list of subscriptions. */
  head: IDependencyNode | null;
  /** The last node in the doubly linked list of subscriptions. */
  tail: IDependencyNode | null;
  /** The topological rank of this data source. */
  rank: number;
  /** The subscriber that owns this observable (e.g., if this is a Memo's internal observable). */
  owner: ISubscriber | null;

  /** Tracks the currently active subscriber as a dependency. */
  track(): void;
  /**
   * Triggers updates for all registered subscribers.
   * @param isDirectChange - Whether this trigger is caused by a direct value change (Signal) or an indirect one (Memo).
   */
  trigger(isDirectChange?: boolean): void;
  /** Removes a specific node from the dependency list. */
  remove(node: IDependencyNode): void;
}

/**
 * Represents a node in the dependency graph, linking a subscriber to an observable source.
 */
export interface IDependencyNode {
  /** The subscriber that depends on the data source. */
  subscriber: ISubscriber | null;
  /** The observable list that this node belongs to. */
  list: IObservable | null;
  /** Link to the previous node in the doubly linked list. */
  prev: IDependencyNode | null;
  /** Link to the next node in the doubly linked list. */
  next: IDependencyNode | null;
}
