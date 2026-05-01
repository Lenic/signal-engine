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

  /** Executes the reactive logic for this subscriber. */
  run(): void;
  /** Permanently stops the subscriber from reacting to further updates. */
  stop(): void;
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

  /** Tracks the currently active subscriber as a dependency. */
  track(): void;
  /** Triggers updates for all registered subscribers. */
  trigger(): void;
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
