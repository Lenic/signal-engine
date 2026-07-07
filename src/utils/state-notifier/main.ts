import { IStateNotifier } from './types';
import { ILinkedList, ILinkedNode, LinkedList } from '../linked-list';
import { Disposable } from '../disposable';
import { ErrorScope } from '../error-scope';

export class StateNotifier<T> extends Disposable implements IStateNotifier<T> {
  private _value: T;
  private _subscribers: ILinkedList<(value: T) => void>;

  constructor(value: T) {
    super();
    this._value = value;
    this._subscribers = new LinkedList<(value: T) => void>();
  }

  get value(): T {
    return this._value;
  }

  notify(value: T): void {
    this._value = value;

    ErrorScope.current.run((context) => {
      let node = this._subscribers.head;
      while (node) {
        context.capture(() => node!.value(value));
        node = node.next;
      }
    });
  }

  subscribe(listener: (value: T) => void): () => void {
    let node: ILinkedNode<(value: T) => void> | null = this._subscribers.append(listener);

    node.onRemoved = () => void (node = null);
    return () => node?.removeSelf();
  }
}
