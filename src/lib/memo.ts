import { IObservable } from '../utils/observable';
import { ISubscriber } from '../utils/subscriber';
import { IReadonlySignalValue } from '../core';

export function memo<T>(fn: () => T): IReadonlySignalValue<T> {
  let value = null as unknown as T;

  const observable = null as unknown as IObservable;
  const subscriber = null as unknown as ISubscriber;

  function getter(): T {
    observable.track();
    return value;
  }

  return getter;
}
