import { ILinkedListInternalActions, ILinkedNode } from './types';

export class LinkedNode<T> implements ILinkedNode<T> {
  value: T;
  next: ILinkedNode<T> | null;
  previous: ILinkedNode<T> | null;
  list: ILinkedListInternalActions<T>;
  onRemoved: ((node: ILinkedNode<T>) => void) | null;

  constructor(value: T, list: ILinkedListInternalActions<T>) {
    this.list = list;
    this.value = value;

    this.next = null;
    this.previous = null;
    this.onRemoved = null;
  }

  insertBefore(value: T): ILinkedNode<T> {
    if (!this.list) {
      throw new Error('[LinkedNode]: can not find the owning list.');
    }

    return this.list.insertNodeBefore(this, value);
  }

  insertAfter(value: T): ILinkedNode<T> {
    if (!this.list) {
      throw new Error('[LinkedNode]: can not find the owning list.');
    }

    return this.list.insertNodeAfter(this, value);
  }

  removeSelf(): void {
    this.list.remove(this);
    this.clear();
  }

  clear(): void {
    try {
      this.onRemoved?.(this);
    } finally {
      this.next = null;
      this.previous = null;
      this.onRemoved = null;

      this.value = undefined as unknown as T;
      this.list = undefined as unknown as ILinkedListInternalActions<T>;
    }
  }
}
