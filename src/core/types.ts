import { IDisposable, ILinkedList, ILinkedNode } from '../utils';

/**
 * Represents a connection between a subscriber and an observable.
 */
export interface IConnector {
  /** The version of the subscriber when this connection was last validated. */
  lastVersion: number;
  /** The observable being tracked. */
  observable: IObservable;
  /** The node in the observable's subscriber list representing this subscription. */
  subscriberNode: ILinkedNode<ISubscriber>;
}

/**
 * Represents an entity that can subscribe to observables and be notified of changes.
 */
export interface ISubscriber extends IDisposable {
  /** The current version of the subscriber, incremented on each run. */
  version: number;
  /** The children subscribers of this subscriber. */
  children: ILinkedList<ISubscriber> | null;
  /** The list of observables this subscriber currently depends on. */
  dependencies: ILinkedList<IConnector>;
  /** The current connector being processed during the tracking phase. */
  currentConnector: ILinkedNode<IConnector> | null;

  /**
   * Executes the subscriber's logic, tracking any observables accessed during execution.
   *
   * @param customAction Optional custom action to run instead of the default action.
   */
  run(customAction?: () => void): void;
  /**
   * Schedules the subscriber to be processed by the scheduler.
   */
  scheduleUpdate(): void;
}

/**
 * Represents an entity that can be observed and notifies its subscribers when it changes.
 */
export interface IObservable {
  /**
   * Indicates whether the observable is currently in the queue to be processed.
   * This is used to prevent the observable from being added to the queue multiple times.
   */
  isInQueue: boolean;
  /** The list of subscribers currently observing this observable. */
  subscribers: ILinkedList<ISubscriber>;

  /**
   * Registers the active subscriber as a dependency of this observable.
   */
  track(): void;

  /**
   * Notifies all subscribers that the observable's value has changed.
   */
  trigger(): void;
}

export const ETaskStatus = {
  IDLE: 'idle',
  UPDATING: 'updating',
  RUNNING: 'running',
} as const;
export type ETaskStatus = (typeof ETaskStatus)[keyof typeof ETaskStatus];

export interface IPendingObservable {
  observable: IObservable;
  originalValue: unknown;
  comparator(a: unknown, b: unknown): boolean;
  valueOf(): unknown;
}

export interface IScheduler {
  deepComparator: null | ((a: unknown, b: unknown) => boolean);
  /** The status of the scheduler. */
  taskStatus: ETaskStatus;
  /** The currently active subscriber being processed. */
  activeSubscriber: ISubscriber | null;
  /** The list of subscribers that are queued to be processed. */
  dirtySubscribers: ILinkedList<ISubscriber>;
  /** The list of observables that are queued to be processed. */
  dirtyObservables: ILinkedList<IPendingObservable>;

  /**
   * Runs a task in the scheduler's context.
   * @param action The task to run.
   */
  batch(action: () => void): void;
  /**
   * Flushes the dirty subscribers.
   */
  flushSubscribers(): void;
  /**
   * Flushes the dirty observables.
   */
  flushObservables(): void;
}

/**
 * Represents a read-only signal value that can be read.
 */
export interface IReadonlySignalValue<T> {
  /**
   * Gets the current value of the signal.
   */
  (): T;
}

/**
 * Options for creating or updating a signal value.
 */
export interface ISignalValueOptions {
  /**
   * The comparator function to use for comparing values.
   *
   * - `'deep'`: Deep comparison by the global default comparator.
   * - `'shallow'`: Shallow comparison by `===`.
   * - `(a: T, b: T) => boolean`: Custom comparator.
   */
  comparator?: 'deep' | 'shallow' | ((a: unknown, b: unknown) => boolean);
}

/**
 * Represents a writable signal value that can be read and updated.
 */
export interface ISignalValue<T> extends IReadonlySignalValue<T> {
  /**
   * Sets a new value for the signal.
   * @param value The new value to set.
   */
  (value: T, options?: ISignalValueOptions): void;
}
