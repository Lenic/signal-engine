import type { IDisposable } from '../disposable';

export interface IStateNotifierOptions<T> {
  name?: string;
  comparer?: (x: T, y: T) => boolean;
}

/**
 * Interface for a state notifier
 *
 * @template T The type of the value
 */
export interface IStateNotifier<T> extends IDisposable {
  readonly name?: string;
  /**
   * The current value of the notifier
   */
  readonly value: T;

  /**
   * Notifies all subscribers with the new value
   */
  notify(value: T): void;

  /**
   * Subscribes a listener to the notifier
   *
   * @param listener Callback function to be executed when the value changes
   * @returns Function to unsubscribe the listener
   */
  subscribe(listener: (value: T) => void): () => void;
}
