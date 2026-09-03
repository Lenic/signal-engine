export interface ILinkedNode<T> {
  value: T;
  next: ILinkedNode<T> | null;
  previous: ILinkedNode<T> | null;

  removeSelf(): void;
  insertAfter(value: T): ILinkedNode<T>;
  insertBefore(value: T): ILinkedNode<T>;
  onRemoved: ((node: ILinkedNode<T>) => void) | null;
}

export interface ILinkedList<T> {
  readonly size: number;
  readonly head: ILinkedNode<T> | null;
  readonly tail: ILinkedNode<T> | null;

  append(value: T): ILinkedNode<T>;
  prepend(value: T): ILinkedNode<T>;
  remove(node: ILinkedNode<T>): void;
}

export interface ILinkedListInternalActions<T> {
  remove(node: ILinkedNode<T>): void;
  insertNodeAfter(node: ILinkedNode<T> | null, value: T): ILinkedNode<T>;
  insertNodeBefore(node: ILinkedNode<T> | null, value: T): ILinkedNode<T>;
}
