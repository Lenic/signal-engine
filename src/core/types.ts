import { IComparable, IDisposable, ILinkedList, ILinkedNode, IQueueable } from '../utils';

/**
 * The type of the signal.
 */
export const ESignalType = {
  /**
   * The type of the signal.
   */
  SIGNAL: 'signal',
  /**
   * The type of the effect.
   */
  EFFECT: 'effect',
  /**
   * The type of the memo.
   */
  MEMO: 'memo',
} as const;
/**
 * Enum for signal types.
 */
export type ESignalType = (typeof ESignalType)[keyof typeof ESignalType];

/**
 * The status of the task.
 */
export const ETaskStatus = {
  /**
   * The status of the task is idle.
   */
  IDLE: 'idle',
  /**
   * The status of the task is updating.
   */
  UPDATING: 'updating',
  /**
   * The status of the task is running.
   */
  RUNNING: 'running',
} as const;
/**
 * Enum for task status.
 */
export type ETaskStatus = (typeof ETaskStatus)[keyof typeof ETaskStatus];

/**
 * Options for signal.
 */
export interface ISignalOptions {
  /**
   * The name of the signal.
   */
  name?: string;
  /**
   * The type of the signal.
   */
  type?: ESignalType;
}

/**
 * Base type for all signals.
 */
export interface ISignalObject {
  /**
   * The unique identifier of the signal.
   *
   * - ordered by the creation time (smaller is older).
   */
  readonly id: number;
  /**
   * The name of the signal.
   */
  readonly name?: string;
  /**
   * Returns the version of the current instance.
   */
  readonly version: number;
  /**
   * The type of the signal.
   */
  readonly type: ESignalType;
}

/**
 * Represents an observable that is queued to be processed by the scheduler.
 */
export interface IPendingObservable {
  /**
   * The observable that is queued to be processed.
   */
  observable: IObservable;
  /**
   * The original value of the observable before the update.
   */
  originalValue: any;
  /**
   * The comparator used to compare the values of the observable.
   */
  comparator: IComparable<any>;
}

/**
 * Represents a connection between a subscriber and an observable.
 */
export interface IConnector {
  /**
   * The version of the subscriber when this connection was last validated.
   */
  lastRunVersion: number;
  /**
   * The version of the observable when this connection was last validated.
   */
  lastObservableVersion: number;
  /**
   * The observable being tracked.
   */
  observable: IObservable;
  /**
   * The node in the observable's subscriber list.
   *
   * - can be removed from observable's subscriber list when the `removeSelf` method called.
   */
  subscriberNode: ILinkedNode<ISubscriber>;
}

/**
 * Represents an entity that can subscribe to observables and be notified of changes.
 */
export interface ISubscriber extends ISignalObject, IDisposable {
  /**
   * The children subscribers of this subscriber.
   */
  children: ILinkedList<ISubscriber> | null;
  /**
   * The list of observables this subscriber currently depends on.
   */
  dependencies: ILinkedList<IConnector>;
  /**
   * The current connector being processed during the tracking phase.
   */
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
  /**
   * Sets the current connector node.
   * @param connectorNode The current connector node.
   */
  setConnectorNode(connectorNode: ILinkedNode<IConnector> | null): void;
}

/**
 * Represents an entity that can be observed and notifies its subscribers when it changes.
 */
export interface IObservable extends ISignalObject {
  /**
   * The queue of pending updates.
   */
  readonly queue: IQueueable<IPendingObservable>;
  /**
   * The list of subscribers currently observing this observable.
   */
  readonly subscribers: ILinkedList<ISubscriber>;

  /**
   * Registers the active subscriber as a dependency of this observable.
   */
  track(): void;

  /**
   * Notifies all subscribers that the observable's value has changed.
   */
  trigger(): void;

  /**
   * Upgrades the version of the observable.
   */
  upgradeVersion(): void;
}

export interface IScheduler {
  /**
   * The status of the scheduler.
   */
  status: ETaskStatus;
  /**
   * The currently active subscriber being processed.
   */
  activeSubscriber: ISubscriber | null;
  /**
   * The list of subscribers that are queued to be processed.
   */
  dirtySubscribers: ILinkedList<ISubscriber>;
  /**
   * The list of observables that are queued to be processed.
   */
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
