import { Disposable } from '../disposable';
import { EqualComparer, IEqualComparer } from '../equal-comparer';
import { ErrorScope } from '../error-scope';
import { ILinkedList, ILinkedNode, LinkedList } from '../linked-list';
import { IStateNotifier, IStateNotifierOptions } from './types';

export class StateNotifier<T> extends Disposable implements IStateNotifier<T> {
  private _name?: string;
  private _comparer: IEqualComparer<T>;
  private _subscribers: ILinkedList<(value: T) => void>;

  constructor(value: T, options?: IStateNotifierOptions<T>) {
    super();

    this._name = options?.name;

    this._comparer = new EqualComparer(options?.comparer);
    this._comparer.setValue(value);

    this._subscribers = new LinkedList<(value: T) => void>();
  }

  get name(): string | undefined {
    return this._name;
  }

  get value(): T {
    return this._comparer.value;
  }

  notify(value: T): void {
    if (!this._comparer.setValue(value)) return;

    ErrorScope.getInstance().run((context) => this._subscribers.forEach((v) => context.capture(() => v(value))));
  }

  subscribe(listener: (value: T) => void): () => void {
    let node: ILinkedNode<(value: T) => void> | null = this._subscribers.append(listener);

    node.onRemoved = () => void (node = null);
    return () => node?.removeSelf();
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();

    this._comparer.dispose();
    this._subscribers.clear();
  }
}
