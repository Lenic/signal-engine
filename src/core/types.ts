import { IDisposable, IErrorScopeContext, ILinkedList } from '../utils';

export interface IObjectOptions {
  name?: string;
}

export interface IDirtyMarkable extends IDisposable {
  readonly name?: string;
  readonly isDirty: boolean;

  markDirty(): void;

  /**
   * Callback invoked when this object turns dirty
   *
   * - assign to listen, set to null to stop listening
   * - a single slot, because every dependency here has exactly one interested party
   * - fires on the transition into dirty only, never on a mark that changes nothing
   * - set to null on disposal
   */
  onDirty: (() => void) | null;
}

export interface ISchedulable extends IDisposable {
  readonly name?: string;
  readonly isScheduled: boolean;

  markScheduled(): void;
  clearScheduled(): void;

  /**
   * Callback invoked when the scheduled state flips
   *
   * - assign to listen, set to null to stop listening
   * - a single slot, for the same reason as `onDirty`
   * - fires on an actual flip only, so re-marking a scheduled task reports nothing
   * - set to null on disposal
   */
  onScheduleChange: ((scheduled: boolean) => void) | null;
}

export interface IVersionFollowerOptions extends IObjectOptions {
  /**
   * @default `false`
   */
  isDirty?: boolean;
}

export interface IVersionFollower extends IDirtyMarkable, IDisposable {
  clearDirty(): void;
}

export interface IVersionLeaderOptions extends IObjectOptions {
  isDirty: boolean;
  /**
   * @default `() => true`
   */
  confirm?: (leader: IVersionLeader) => boolean;
}

/**
 * Remembers which run last took this object as a dependency. A run identifies itself with a
 * token unique for its lifetime, which is what lets a second read inside that same run be
 * recognised - and folded into the slot the first read already claimed - in constant time.
 */
export interface ITrackMarkable {
  /**
   * The snapshot the given run already recorded here, or `null` if that run has not read this
   * object yet.
   */
  trackedBy(token: number): ISnapshot<IVersionLeader> | null;

  /** Records that the given run has taken this object as a dependency. */
  markTracked(token: number, snapshot: ISnapshot<IVersionLeader>): void;
}

export interface IVersionLeader extends IDirtyMarkable, ITrackMarkable, IDisposable {
  /**
   * Increments whenever a confirmation finds this leader's value actually moved. Readers record
   * it alongside the dependency and compare later, which is how an unchanged value stops
   * propagation without anyone recomputing.
   */
  readonly version: number;

  confirm(): number;
  appendFollower(follower: IVersionFollower): () => void;
}

export interface ISnapshot<T> {
  instance: T;
  version: number;
}

export interface IConnector {
  snapshot: ISnapshot<IVersionLeader>;
  unsubscribe: () => void;
}

export interface IConnectorManager<T = void> extends IDisposable {
  readonly name?: string;

  /**
   * Whether the action is executing right now. A value produced by this manager that gets read
   * while this is `true` is being read from inside its own computation - a circular dependency.
   */
  readonly isExecuting: boolean;

  run(): T;
  disconnect(): void;
  track(provider: IVersionLeader): void;

  /**
   * Takes over responsibility for disposing a resource, binding it to the lifetime of the
   * *current execution* rather than to the manager as a whole.
   *
   * Adopted resources are released right before every recomputation and when the manager
   * itself is disposed, so anything created while the action runs - a nested effect, a
   * timer, a subscription - can never outlive the run that created it.
   */
  adopt(disposable: IDisposable | (() => void)): void;
}

export interface IPendingSignalUpdate {
  flush(): void;
}

export interface IScheduler {
  isRunning: boolean;
  connectorManager?: IConnectorManager;
  pendingSignalUpdateList: ILinkedList<IPendingSignalUpdate>;
  scheduledConnectorManagerList: ILinkedList<IConnectorManager>;

  batch(action: (context: IErrorScopeContext) => void, finalize?: () => void): void;

  /**
   * Runs an action with the guarantee that a batch is open around it, opening one only when
   * there is not already one running. Meant for callers that just need their notifications to
   * be collected and flushed - not for anything that needs to isolate failures of its own, which
   * has to go through `batch` and use the error scope it hands out.
   */
  runBatched(action: () => void): void;

  /**
   * Applies every write the running batch has queued so far. A write takes effect on the value
   * immediately but publishes its dirt at flush time, so a read that travels *through* the
   * graph - rather than straight off a signal - has to settle those writes first, or it answers
   * from a cache the batch has already invalidated.
   */
  settlePendingWrites(): void;
}
