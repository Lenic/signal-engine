import type { LinkedNode } from './node';
import { LinkedNodePool } from './pool';
import type { ILinkedList, ILinkedListInternalActions, ILinkedNode } from './types';

export class LinkedList<T> implements ILinkedList<T>, ILinkedListInternalActions<T> {
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
    return this.insertNodeBefore(this._head, value);
  }

  append(value: T): ILinkedNode<T> {
    return this.insertNodeAfter(this._tail, value);
  }

  remove(node: ILinkedNode<T>): void {
    const internalNode = node as LinkedNode<T>;

    if (internalNode.list !== this) {
      throw new Error('[LinkedNode]: the node does not belong to this list.');
    }

    if (internalNode.prev) {
      internalNode.prev.next = internalNode.next;
    } else {
      this._head = internalNode.next;
    }

    if (internalNode.next) {
      internalNode.next.prev = internalNode.prev;
    } else {
      this._tail = internalNode.prev;
    }

    this._size--;

    LinkedNodePool.release(internalNode);
  }

  clear(): void {
    let current = this._head;
    while (current) {
      this.remove(current);
      current = current.next;
    }

    this._size = 0;
    this._head = null;
    this._tail = null;
  }

  insertNodeBefore(node: ILinkedNode<T> | null, value: T): ILinkedNode<T> {
    const internalNode = node as LinkedNode<T> | null;

    if (internalNode && internalNode.list !== this) {
      throw new Error('[LinkedNode]: the node does not belong to this list.');
    }

    const newNode = LinkedNodePool.acquire(value, this);
    this._size++;

    newNode.next = internalNode ?? null;
    newNode.prev = internalNode?.prev ?? null;

    if (internalNode) {
      if (internalNode?.prev) {
        internalNode.prev.next = newNode;
      }
      internalNode.prev = newNode;
    }

    // fix the heading node
    if (this._head === internalNode) {
      this._head = newNode;
    }

    // update the tail node if the tail node is null
    if (!this.tail) {
      this._tail = newNode;
    }

    return newNode;
  }

  insertNodeAfter(node: ILinkedNode<T> | null, value: T): ILinkedNode<T> {
    const internalNode = node as LinkedNode<T> | null;

    if (internalNode && internalNode.list !== this) {
      throw new Error('[LinkedNode]: the node does not belong to this list.');
    }

    const newNode = LinkedNodePool.acquire(value, this);
    this._size++;

    newNode.prev = internalNode ?? null;
    newNode.next = internalNode?.next ?? null;

    if (internalNode) {
      if (internalNode?.next) {
        internalNode.next.prev = newNode;
      }
      internalNode.next = newNode;
    }

    // update the tail node if the internal node is null
    if (this._tail === internalNode) {
      this._tail = newNode;
    }

    // fix the heading node
    if (!this._head) {
      this._head = newNode;
    }

    return newNode;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this._head;
    while (current) {
      if (current.value !== undefined) {
        result.push(current.value);
      }
      current = current.next;
    }
    return result;
  }
}
