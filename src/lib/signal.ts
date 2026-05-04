import { ISignalValue } from './types';

/**
 * Create a new signal with the given value.
 * @param value The initial value of the signal.
 * @returns A signal that can be read from and written to.
 */
export function signal<T>(value: T): ISignalValue<T> {
  let _value = value;
  const _subscribers = new Set<ISubscriber>();

  const _signal = (): T => {
    return _value;
  };

  _signal.set = (value: T) => {
    _value = value;
    _subscribers.forEach((subscriber) => {
      subscriber.requestUpdate();
    });
  };

  return _signal;
}
