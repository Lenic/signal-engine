/**
 * Represents a node in the dependency graph, linking a subscriber to a source.
 */
export interface DependencyNode {
  /**
   * The subscriber that depends on the data source.
   * Can be nulled during cleanup to assist garbage collection.
   */
  subscriber: Subscriber | null;
  /**
   * The list of dependencies this node belongs to.
   */
  dependencyList: DependencyList | null;
  /**
   * Link to the previous node in the doubly linked list.
   */
  prev: DependencyNode | null;
  /**
   * Link to the next node in the doubly linked list.
   */
  next: DependencyNode | null;
}

/**
 * A doubly linked list used to efficiently manage a collection of subscribers.
 */
export interface DependencyList {
  /**
   * The first node in the list.
   */
  head: DependencyNode | null;
  /**
   * The last node in the list.
   */
  tail: DependencyNode | null;
  /**
   * The topological rank of this data source.
   * Signals have a rank of 0, while Memos have a rank higher than their dependencies.
   */
  rank: number;
}

/**
 * A reactive unit that can be scheduled to run when its dependencies change.
 */
export interface Subscriber {
  /**
   * The actual task or effect function to execute.
   */
  run: () => void;
  /**
   * A collection of all active subscriptions for this subscriber.
   */
  subscriptions: DependencyNode[];
  /**
   * Optional parent subscriber for nested effect tracking.
   */
  parent: Subscriber | null;
  /**
   * Nested subscribers that should be disposed of if this subscriber stops.
   */
  children: Subscriber[];
  /**
   * Indicates whether the subscriber is currently active and listening for changes.
   */
  active: boolean;
  /**
   * The index of the subscription currently being processed during a run.
   * Used to optimize memory by reusing existing dependency nodes.
   */
  trackingIndex: number;
  /**
   * The topological rank of this subscriber.
   * Used to ensure glitch-free execution order.
   */
  rank: number;
}

/**
 * The standard interface for a reactive Signal.
 */
export interface Signal<T> {
  /**
   * Retrieves the current value and tracks the dependency.
   */
  (): T;
  /**
   * Updates the value and triggers downstream effects.
   * Accepts either a direct value or an updater function.
   */
  set: (valueOrUpdater: T | ((prev: T) => T)) => void;
}

/**
 * A derived reactive value that supports manual disposal.
 */
export interface Memo<T> {
  /**
   * Retrieves the memoized value.
   */
  (): T;
  /**
   * Disposes of the memo's internal subscriber, stopping it from listening to upstreams.
   */
  dispose: () => void;
}
