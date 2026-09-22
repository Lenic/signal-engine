import type { IDisposable, ILinkedList, ILinkedNode } from '../utils';

export interface INamedObject {
  name?: string;
}

export interface IAction<TArgs extends unknown[] = [], TResult = void> {
  (...args: TArgs): TResult;
}

export interface IDirtyMarkable {
  markDirty(): void;
}

export interface IChangeListenerSource<Listener> {
  readonly listeners?: ILinkedList<Listener>;

  addChangeListener(listener: Listener): ILinkedNode<Listener>;
}

export interface ISignalValueOptions<T> extends INamedObject {
  comparer?: IAction<[T, T], boolean>;
}

export interface ISignalValue<T, TListener extends IDirtyMarkable>
  extends INamedObject, IChangeListenerSource<TListener> {
  readonly value: T;
  readonly version: number;

  flush(): void;
  setValue(newValue: T, force?: boolean): void;
}

export interface IEffectAction extends INamedObject, IDisposable {
  readonly action: IAction;

  adopt(effectAction: IEffectAction): void;
  connect<Listener>(source: IChangeListenerSource<Listener>): void;
}
