import { IDisposable } from '../disposable';
import { ILinkedList } from '../linked-list';

/**
 * Represents an entity that can be queued for processing.
 */
export interface IQueueable<T> extends IDisposable {
  /**
   * The list of entities that can be queued for processing.
   */
  readonly list: ILinkedList<T>;
  /**
   * Indicates whether the entity is currently in the queue to be processed.
   * This is used to prevent the entity from being added to the queue multiple times.
   */
  readonly isInQueue: boolean;

  /**
   * Adds the entity to the queue to be processed.
   * @param content The content to add to the queue.
   */
  addToQueue(content: T): void;
  /**
   * Removes the entity from the queue.
   */
  removeFromQueue(): void;
}
