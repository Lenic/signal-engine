export interface ILinkedNode<T> {
  value: T;
  next: ILinkedNode<T> | null;
  previous: ILinkedNode<T> | null;
  onRemoved: ((node: ILinkedNode<T>) => void) | null;

  removeSelf(): void;
  insertAfter(value: T): ILinkedNode<T>;
  insertBefore(value: T): ILinkedNode<T>;
}

export interface ILinkedList<T> {
  readonly size: number;
  readonly head: ILinkedNode<T> | null;
  readonly tail: ILinkedNode<T> | null;

  append(value: T): ILinkedNode<T>;
  prepend(value: T): ILinkedNode<T>;
  remove(node: ILinkedNode<T>): void;
}
