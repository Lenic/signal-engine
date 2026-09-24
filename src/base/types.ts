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

export interface ISignalValueOptions<T> extends INamedObject {
  comparer?: IAction<[T, T], boolean>;
}

export interface ISignalValue<T> extends IVersioned, INamedObject, IChangeListenerSource<IDirtyMarkable> {
  readonly value: T;
  readonly version: number;

  flush(): void;
  setValue(newValue: T, force?: boolean): void;
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

export interface IEffectAction extends INamedObject, IDisposable, IDirtyMarkable {
  /** @internal */
  queueNode?: ILinkedNode<IEffectAction>;

  run(): void;
  adopt(disposable: IDisposable): ILinkedNode<IDisposable>;
}
