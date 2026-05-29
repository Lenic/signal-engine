import { Disposable } from '../disposable';
import { ILinkedList, ILinkedNode } from '../linked-list';
import { IQueueable } from './types';

export class Queueable<T> extends Disposable implements IQueueable<T> {
  private node: ILinkedNode<T> | null;

  list: ILinkedList<T>;
  isInQueue: boolean;

  constructor(list: ILinkedList<T>) {
    super();

    this.list = list;
    this.isInQueue = false;
    this.node = null;
  }

  addToQueue(content: T): void {
    if (this.isInQueue) return;

    this.node = this.list.add(content);
    this.isInQueue = true;
  }

  removeFromQueue(): void {
    this.node?.removeSelf();
    this.isInQueue = false;
  }

  dispose(): void {
    if (this.isDisposed) return;

    super.dispose();
    this.removeFromQueue();

    this.list = undefined as unknown as ILinkedList<T>;
    this.node = undefined as unknown as ILinkedNode<T>;
    this.isInQueue = undefined as unknown as boolean;
  }
}
