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
}

export interface ISnapshot {
  version: number;
  instance: IVersioned;
  node: ILinkedNode<IDirtyMarkable>;
}

/** @internal */
export interface IConnectManager {
  connectors: ILinkedList<ISnapshot>;
  currentConnect?: ILinkedNode<ISnapshot> | null;
}

export interface IEffectOwner {
  adopt(disposable: IDisposable): ILinkedNode<IDisposable>;
}

export interface IEffectAction extends INamedObject, IDisposable, IDirtyMarkable, IEffectOwner {
  run(): void;
}

export interface IMemoValue<T>
  extends INamedObject, IDisposable, IDirtyMarkable, IVersioned, IChangeListenerSource<IDirtyMarkable> {
  readonly value: T;
}
