import { LinkedNode } from './node';
import { LinkedNodePool } from './pool';
import { ILinkedList, TLinkedListHook, ILinkedNode } from './types';

export class LinkedList<T> implements ILinkedList<T> {
  private _size: number = 0;
  private _hooks: TLinkedListHook<T>[] = [];
  private _head: ILinkedNode<T> | null = null;
  private _tail: ILinkedNode<T> | null = null;

  public get size(): number {
    return this._size;
  }

  public get head(): ILinkedNode<T> | null {
    return this._head;
  }

  public get tail(): ILinkedNode<T> | null {
    return this._tail;
  }

  add(value: T): ILinkedNode<T> {
    this._hooks.forEach((fn) => fn('add', value));

    return this.addCore(value);
  }

  remove(node: ILinkedNode<T>): void {
    this._hooks.forEach((fn) => fn('remove', node));

    this.removeCore(node);
  }

  clear(): void {
    this._hooks.forEach((fn) => fn('clear'));

    this.clearCore();
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

  addHook(fn: TLinkedListHook<T>): () => void {
    this._hooks.push(fn);
    return () => {
      const index = this._hooks.indexOf(fn);
      if (index >= 0) {
        this._hooks.splice(index, 1);
      }
    };
  }

  private addCore(value: T): ILinkedNode<T> {
    const newNode = LinkedNodePool.acquire(value, this);

    if (!this._head) {
      this._head = newNode;
      this._tail = newNode;
    } else {
      newNode.prev = this._tail;
      if (this._tail) {
        this._tail.next = newNode;
      }
      this._tail = newNode;
    }

    this._size++;
    return newNode;
  }

  private removeCore(node: ILinkedNode<T>): void {
    const internalNode = node as LinkedNode<T>;

    if (!internalNode || internalNode.list !== this) {
      return;
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

  private clearCore(): void {
    let current = this._head;
    while (current) {
      this.removeCore(current);
      current = current.next;
    }
  }
}
