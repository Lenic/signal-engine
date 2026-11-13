export interface IDisposable {
  readonly isDisposed: boolean;

  dispose(): void;
}

export interface INamedObject {
  name?: string;
}

export interface IAction<TArgs extends unknown[] = [], TResult = void> {
  (...args: TArgs): TResult;
}

export interface IValueOptions<T> extends INamedObject {
  comparer?: IAction<[T, T], boolean>;
}

export interface IConnectible extends INamedObject {
  readonly version: number;

  lastRunId?: number;
  lastRunnable?: IRunnable;

  runnableHead?: IConnector;
  runnableTail?: IConnector;
}

export interface IRunnable extends IDisposable, INamedObject {
  readonly runId: number;

  connectibleHead?: IConnector;
  connectibleTail?: IConnector;

  connectibleCurrent?: IConnector;

  markDirty(): void;
}

export interface IConnector extends IDisposable {
  runnable: IRunnable;
  connectible: IConnectible;
  connectibleVersion: number;

  prevConnectible?: IConnector;
  nextConnectible?: IConnector;

  prevRunnable?: IConnector;
  nextRunnable?: IConnector;

  appendToAll(): void;
  updateConnectible(connectible: IConnectible, connectibleVersion: number): void;
}

export interface ISignalValue<T> extends IConnectible {
  readonly value: T;

  setValue(newValue: T, force?: boolean): void;
}

export interface IBatchSnapshot<T = unknown> {
  instance: ISignalValue<T>;
  version: number;
  value: T;
  hasBeenRead: boolean;
}

export interface ILinked<T> {
  value: T;
  prev?: ILinked<T>;
  next?: ILinked<T>;
}

export interface IEffectOwner {
  childrenHead?: ILinked<IDisposable>;
  childrenTail?: ILinked<IDisposable>;

  adopt(disposable: IDisposable): ILinked<IDisposable>;
}

export interface IEffectAction extends IRunnable, IEffectOwner {
  isEnqueued: boolean;

  run(): void;
}

export interface IMemoValue<T> extends IRunnable, IConnectible {
  readonly value: T;
}
