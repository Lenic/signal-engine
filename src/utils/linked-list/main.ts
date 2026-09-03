import { LinkedNode } from './node';
import type { ILinkedList, ILinkedListInternalActions, ILinkedNode } from './types';

export class LinkedList<T> implements ILinkedList<T>, ILinkedListInternalActions<T> {
  size: number;
  head: ILinkedNode<T> | null;
  tail: ILinkedNode<T> | null;

  constructor() {
    this.size = 0;
    this.head = null;
    this.tail = null;
  }

  prepend(value: T): ILinkedNode<T> {
    return this.insertNodeBefore(this.head, value);
  }

  append(value: T): ILinkedNode<T> {
    return this.insertNodeAfter(this.tail, value);
  }

  remove(node: ILinkedNode<T>): void {
    const internalNode = node as LinkedNode<T>;

    if (internalNode.list !== this) {
      throw new Error('[LinkedNode]: the node does not belong to this list.');
    }

    if (internalNode.previous) {
      internalNode.previous.next = internalNode.next;
    } else {
      this.head = internalNode.next;
    }

    if (internalNode.next) {
      internalNode.next.previous = internalNode.previous;
    } else {
      this.tail = internalNode.previous;
    }

    this.size--;
    internalNode.clear();
  }

  insertNodeBefore(node: ILinkedNode<T> | null, value: T): ILinkedNode<T> {
    const internalNode = node as LinkedNode<T> | null;

    if (internalNode && internalNode.list !== this) {
      throw new Error('[LinkedNode]: the node does not belong to this list.');
    }

    const newNode = new LinkedNode(value, this);
    this.size++;

    newNode.next = internalNode ?? null;
    newNode.previous = internalNode?.previous ?? null;

    if (internalNode) {
      if (internalNode?.previous) {
        internalNode.previous.next = newNode;
      }
      internalNode.previous = newNode;
    }

    // fix the heading node
    if (this.head === internalNode) {
      this.head = newNode;
    }

    // update the tail node if the tail node is null
    if (!this.tail) {
      this.tail = newNode;
    }

    return newNode;
  }

  insertNodeAfter(node: ILinkedNode<T> | null, value: T): ILinkedNode<T> {
    const internalNode = node as LinkedNode<T> | null;

    if (internalNode && internalNode.list !== this) {
      throw new Error('[LinkedNode]: the node does not belong to this list.');
    }

    const newNode = new LinkedNode(value, this);
    this.size++;

    newNode.previous = internalNode ?? null;
    newNode.next = internalNode?.next ?? null;

    if (internalNode) {
      if (internalNode?.next) {
        internalNode.next.previous = newNode;
      }
      internalNode.next = newNode;
    }

    // update the tail node if the internal node is null
    if (this.tail === internalNode) {
      this.tail = newNode;
    }

    // fix the heading node
    if (!this.head) {
      this.head = newNode;
    }

    return newNode;
  }
}
