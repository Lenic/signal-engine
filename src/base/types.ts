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

export const DIRTY_TYPE_CLEAN = 0;
export const DIRTY_TYPE_UNCHECKED = 1;
export const DIRTY_TYPE_DIRTY = 2;

export type TDirtyType = typeof DIRTY_TYPE_CLEAN | typeof DIRTY_TYPE_UNCHECKED | typeof DIRTY_TYPE_DIRTY;
export type TMarkableDirtyType = Exclude<TDirtyType, typeof DIRTY_TYPE_CLEAN>;

export interface IDirtyable {
  readonly dirtyType: TDirtyType;
}

export interface IConnectible extends IDirtyable, IDisposable, INamedObject {
  readonly version: number;

  lastRunId?: number;
  lastRunnable?: IRunnable;

  runnableHead?: IConnector;
  runnableTail?: IConnector;

  refresh(): void;
}

export interface IRunnable extends IDirtyable, IDisposable, INamedObject {
  readonly runId: number;

  connectibleHead?: IConnector;
  connectibleTail?: IConnector;

  connectibleCurrent?: IConnector;

  markDirty(dirtyType: TMarkableDirtyType): IConnector | undefined;
}

export interface IConnector extends IDisposable {
  runnable: IRunnable;
  connectible: IConnectible;
  connectibleVersion: number;

  prevConnectible?: IConnector;
  nextConnectible?: IConnector;

  prevRunnable?: IConnector;
  nextRunnable?: IConnector;

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
