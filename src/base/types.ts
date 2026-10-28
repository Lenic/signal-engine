import type { IDisposable, ILinkedList, ILinkedNode } from '../utils';

export interface INamedObject {
  name?: string;
}

export interface IAction<TArgs extends unknown[] = [], TResult = void> {
  (...args: TArgs): TResult;
}

export interface IVersioned {
  readonly version: number;
}

export interface IDirtyMarkable {
  markDirty(): void;
}

export interface IChangeListenerSource<TListener> {
  readonly listeners?: ILinkedList<TListener>;

  addChangeListener(listener: TListener): ILinkedNode<TListener>;
}

export interface IValueOptions<T> extends INamedObject {
  comparer?: IAction<[T, T], boolean>;
}

export interface ISignalValue<T> extends IVersioned, INamedObject, IChangeListenerSource<IDirtyMarkable> {
  readonly value: T;
  readonly version: number;

  setValue(newValue: T, force?: boolean): void;
}

export interface IBatchSnapshot<T = unknown> {
  instance: ISignalValue<T>;
  version: number;
  value: T;
  hasBeenRead: boolean;
}

export interface ISnapshot {
  version: number;
  instance: IVersioned;
  node: ILinkedNode<IDirtyMarkable>;
}

/** @internal */
export interface IConnectManager extends IDisposable {
  readonly runId: number;
  readonly connectors: ILinkedList<ISnapshot>;
  currentConnect?: ILinkedNode<ISnapshot> | null;
}

export interface IRunnable extends IDirtyMarkable, IConnectManager, IDisposable, INamedObject {}

export interface IConnectable extends IVersioned, IChangeListenerSource<IDirtyMarkable> {
  lastRunId?: number;
  lastInstance?: IConnectManager;
}

export interface IEffectOwner {
  adopt(disposable: IDisposable): ILinkedNode<IDisposable>;
}

export interface IEffectAction extends IRunnable, IEffectOwner {
  run(): void;
}

export interface IMemoValue<T> extends IRunnable, IVersioned, IChangeListenerSource<IDirtyMarkable> {
  readonly value: T;
}
