import { IDisposable, IErrorScopeContext, ILinkedList } from '../utils';

export interface IDirtyMarkable extends IDisposable {
  readonly isDirty: boolean;

  markDirty(): void;
  onDirty(callback: () => void): () => void;
}

export interface IVersioned extends IDisposable {
  readonly version: number;

  onVersionChanged(callback: (version: number) => void): () => void;
}

export interface ISchedulable extends IDisposable {
  readonly isScheduled: boolean;

  markScheduled(): void;
  clearScheduled(): void;
  onScheduleChange(listener: (scheduled: boolean) => void): () => void;
}

export interface IVersionFollower extends IDirtyMarkable, IDisposable {
  clearDirty(): void;
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

export interface IConnectorManager extends IDisposable {
  run(): void;
  track(provider: IVersionLeader): void;
}

export interface IScheduler {
  isRunning: boolean;
  connectorManager?: IConnectorManager;
  pendingActionList: ILinkedList<() => void>;
  scheduledConnectorManagerList: ILinkedList<IConnectorManager>;

  batch(action: (context: IErrorScopeContext) => void, finalize?: () => void): void;
}
