import { IDisposable, IErrorScopeContext, ILinkedList } from '../utils';

export interface IObjectOptions {
  name?: string;
}

export interface IDirtyMarkable extends IDisposable {
  readonly name?: string;
  readonly isDirty: boolean;

  markDirty(): void;
  onDirty(callback: () => void): () => void;
}

export interface IVersioned extends IDisposable {
  readonly version: number;

  onVersionChanged(callback: (version: number) => void): () => void;
}

export interface ISchedulable extends IDisposable {
  readonly name?: string;
  readonly isScheduled: boolean;

  markScheduled(): void;
  clearScheduled(): void;
  onScheduleChange(listener: (scheduled: boolean) => void): () => void;
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
  confirm: (leader: IVersionLeader) => boolean;
}

export interface IVersionLeader extends IDirtyMarkable, IVersioned, IDisposable {
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
}
