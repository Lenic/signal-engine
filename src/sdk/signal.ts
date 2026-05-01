import { Observable } from './observable';

/**
 * Represents a discrete, reactive state primitive.
 */
export class Signal<T> extends Observable {
  /** The internal state value. */
  private _value: T;

  /**
   * Creates a new reactive signal.
   *
   * @param initialValue - The initial value of the signal.
   */
  constructor(initialValue: T) {
    super();
    this._value = initialValue;
  }

  /**
   * Retrieves the current value and registers the active subscriber as a dependency.
   */
  public get value(): T {
    this.track();
    return this._value;
  }

  /**
   * Updates the signal's value and triggers updates for all registered subscribers.
   */
  public set value(newValue: T) {
    if (!Object.is(this._value, newValue)) {
      this._value = newValue;
      this.trigger();
    }
  }

  /**
   * Updates the value using an updater function.
   *
   * @param updater - A function that receives the previous value and returns the new value.
   */
  public update(updater: (prev: T) => T): void {
    this.value = updater(this._value);
  }
}
