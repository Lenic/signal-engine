/**
 * Represents a signal value that can be read from and written to.
 * @template T The type of the value.
 */
/**
 * Represents a signal value that can be read from and written to.
 * @template T The type of the value.
 */
export interface ISignalValue<T> {
  /**
   * Get the value of a signal.
   * @returns The value of the signal.
   */
  (): T;
  /**
   * Set the value of a signal.
   * @param value The value to set.
   */
  set(value: T): void;
}

/**
 * Represents a subscriber that can be run.
 */
export interface ISubscriber {
  /**
   * Run the subscriber.
   */
  run(): void;
  /**
   * Request an update for the subscriber.
   */
  requestUpdate(): void;
}
