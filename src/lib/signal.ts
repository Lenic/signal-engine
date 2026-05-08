import { ISignalValue, Observable } from '../core';

/**
 * Creates a signal with the given initial value.
 * @param initialValue The initial value of the signal.
 * @returns A signal with the given initial value.
 */
export function signal<T>(initialValue: T): ISignalValue<T> {
  let value = initialValue;
  const observable = new Observable();

  function getter(): T {
    observable.track();
    return value;
  }

  getter.set = (nextValue: T) => {
    if (value !== nextValue) {
      value = nextValue;
      observable.trigger();
    }
  };

  return getter;
}
