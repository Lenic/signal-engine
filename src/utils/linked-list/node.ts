import { ILinkedList, ILinkedListInternalActions, ILinkedNode } from './types';

export class LinkedNode<T> implements ILinkedNode<T> {
  value: T;
  prev: ILinkedNode<T> | null;
  next: ILinkedNode<T> | null;
  list: ILinkedList<T> | null;
  onRemoved: ((node: ILinkedNode<T>) => void) | null;

  constructor(value: T) {
    this.value = value;

    this.prev = null;
    this.next = null;
    this.list = null;
    this.onRemoved = null;
  }

  insertBefore(value: T): ILinkedNode<T> {
    if (!this.list) {
      throw new Error('[LinkedNode]: can not find the owning list.');
    }

    return (this.list as unknown as ILinkedListInternalActions<T>).insertNodeBefore(this, value);
  }

  insertAfter(value: T): ILinkedNode<T> {
    if (!this.list) {
      throw new Error('[LinkedNode]: can not find the owning list.');
    }

    return (this.list as unknown as ILinkedListInternalActions<T>).insertNodeAfter(this, value);
  }

  removeSelf(): void {
    if (this.list) {
      this.list.remove(this);

      this.clear();
    }
  }

  clear(): void {
    this.onRemoved?.(this);

    this.value = undefined as unknown as T;
    this.prev = null;
    this.next = null;
    this.list = null;
    this.onRemoved = null;
  }
}
