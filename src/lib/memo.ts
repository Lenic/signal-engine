import { IObservable, IReadonlySignalValue, ISubscriber, Observable, Subscriber } from '../core';

/**
 * Creates a computed signal that lazily evaluates and memoizes the result of the provided function.
 *
 * The function is evaluated only when the signal is read and its dependencies have changed.
 * This ensures that unnecessary re-evaluations are avoided, making it highly efficient.
 *
 * @param fn The function to compute the signal's value.
 * @returns A read-only signal representing the memoized value.
 */
export function memo<T>(fn: () => T): IReadonlySignalValue<T> {
  let value: T;
  let isDirty = true;

  const observable: IObservable = new Observable();
  const subscriber: ISubscriber = new Subscriber(() => {
    if (!isDirty) {
      isDirty = true;
      observable.trigger();
    }
  });

  function getter(): T {
    if (isDirty) {
      subscriber.run(() => void (value = fn()));
      isDirty = false;
    }

    observable.track();
    return value;
  }

  return getter;
}
