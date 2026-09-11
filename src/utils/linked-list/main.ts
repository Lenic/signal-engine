import { LinkedNode } from './node';
import type { ILinkedList, ILinkedNode } from './types';

export class LinkedList<T> implements ILinkedList<T> {
  private _size: number;
  private _head: ILinkedNode<T> | null;
  private _tail: ILinkedNode<T> | null;

  constructor() {
    this._size = 0;
    this._head = null;
    this._tail = null;
  }

  get size(): number {
    return this._size;
  }

  get head(): ILinkedNode<T> | null {
    return this._head;
  }

  get tail(): ILinkedNode<T> | null {
    return this._tail;
  }

  prepend(value: T): ILinkedNode<T> {
    if (this._head) {
      return this._head.insertBefore(value);
    } else {
      return this.createFirstNode(value);
    }
  }

  append(value: T): ILinkedNode<T> {
    if (this._tail) {
      return this._tail.insertAfter(value);
    } else {
      return this.createFirstNode(value);
    }
  }

  remove(node: ILinkedNode<T>): void {
    const internalNode = node as LinkedNode<T>;

    if (internalNode.list !== this) {
      throw new Error('[LinkedNode]: the node does not belong to this list.');
    }

    if (internalNode.previous) {
      internalNode.previous.next = internalNode.next;
    } else {
      this._head = internalNode.next;
    }

    if (internalNode.next) {
      internalNode.next.previous = internalNode.previous;
    } else {
      this._tail = internalNode.previous;
    }

    this._size -= 1;
    internalNode.clear();
  }

  /** @internal */
  onNodeInserted(node: ILinkedNode<T>): void {
    this._size += 1;
    if (!node.previous) {
      this._head = node;
    }
    if (!node.next) {
      this._tail = node;
    }
  }

  private createFirstNode(value: T): ILinkedNode<T> {
    const node = new LinkedNode(value, this);
    this.onNodeInserted(node);
    return node;
  }
}
