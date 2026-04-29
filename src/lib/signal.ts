import { Signal, DependencyList } from './types';
import { track, trigger } from './effect';

/**
 * Creates a reactive state primitive.
 */
export function signal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const dependencyList: DependencyList = { head: null, tail: null };

  const getter = (() => {
    track(dependencyList);
    return value;
  }) as Signal<T>;

  getter.set = (valueOrUpdater) => {
    const newValue = typeof valueOrUpdater === 'function'
      ? (valueOrUpdater as (prev: T) => T)(value)
      : valueOrUpdater;

    if (Object.is(newValue, value)) return;

    value = newValue;
    trigger(dependencyList);
  };

  return getter;
}
