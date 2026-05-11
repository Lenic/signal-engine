import { ILinkedList, ILinkedNode } from '../utils';

/**
 * Interface for objects that can be disposed of to release resources.
 */
export interface IDisposable {
  /**
   * Disposes of the resources held by this object.
   */
  dispose(): void;

  /**
   * Registers a disposable or a cleanup function to be executed when this object is disposed.
   * @param disposable The disposable or cleanup function.
   */
  disposeWithMe(disposable: IDisposable | (() => void)): void;
}

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
   */
  run(): void;
  /**
   * Schedules the subscriber to be processed by the scheduler.
   */
  scheduleUpdate(): void;
}

/**
 * Represents an entity that can be observed and notifies its subscribers when it changes.
 */
export interface IObservable {
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

export interface IScheduler {
  /** The status of the scheduler. */
  taskStatus: ETaskStatus;
  /** The currently active subscriber being processed. */
  activeSubscriber: ISubscriber | null;
  /** The list of subscribers that are queued to be processed. */
  dirtySubscribers: ILinkedList<ISubscriber>;

  /**
   * Runs a task in the scheduler's context.
   * @param action The task to run.
   */
  batch(action: () => void): void;
  /**
   * Flushes the dirty subscribers.
   */
  flush(): void;
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
 * Represents a writable signal value that can be read and updated.
 */
export interface ISignalValue<T> extends IReadonlySignalValue<T> {
  /**
   * Sets a new value for the signal.
   * @param value The new value to set.
   */
  set(value: T): void;
}
