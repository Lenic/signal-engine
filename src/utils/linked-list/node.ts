import type { LinkedList } from './main';
import type { ILinkedNode } from './types';

export class LinkedNode<T> implements ILinkedNode<T> {
  value: T;
  /** @internal */
  list: LinkedList<T>;
  next: ILinkedNode<T> | null;
  previous: ILinkedNode<T> | null;
  onRemoved: ((node: ILinkedNode<T>) => void) | null;

  constructor(value: T, list: LinkedList<T>) {
    this.list = list;
    this.value = value;

    this.next = null;
    this.previous = null;
    this.onRemoved = null;
  }

  insertBefore(value: T): ILinkedNode<T> {
    this.assertNotCleared();

    const newNode = new LinkedNode(value, this.list);
    const originalPreviousNode = this.previous;

    newNode.next = this;
    newNode.previous = originalPreviousNode;

    this.previous = newNode;
    if (originalPreviousNode) {
      originalPreviousNode.next = newNode;
    }

    this.list.onNodeInserted(newNode);
    return newNode;
  }

  insertAfter(value: T): ILinkedNode<T> {
    this.assertNotCleared();

    const newNode = new LinkedNode(value, this.list);
    const originalNextNode = this.next;

    newNode.previous = this;
    newNode.next = originalNextNode;

    this.next = newNode;
    if (originalNextNode) {
      originalNextNode.previous = newNode;
    }

    this.list.onNodeInserted(newNode);
    return newNode;
  }

  removeSelf(): void {
    this.assertNotCleared();

    this.list.remove(this);
  }

  /** @internal */
  clear(): void {
    this.assertNotCleared();

    try {
      this.onRemoved?.(this);
    } finally {
      this.next = null;
      this.previous = null;
      this.onRemoved = null;

      this.value = undefined as unknown as T;
      this.list = undefined as unknown as LinkedList<T>;
    }
  }

  private assertNotCleared() {
    if (!this.list) {
      throw new Error('[LinkedNode]: can not find the owning list.');
    }
  }
}
