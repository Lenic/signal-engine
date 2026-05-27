import { ISignalValue, Observable, ISignalValueOptions, IObservable, scheduler, ETaskStatus } from './core';

function defaultComparator(a: any, b: any) {
  return a === b;
}

/**
 * Creates a signal with the given initial value.
 * @param initialValue The initial value of the signal.
 * @param options Options for creating the signal, including a comparator function.
 * @returns A signal with the given initial value.
 */
export function signal<T>(initialValue: T, options?: ISignalValueOptions): ISignalValue<T> {
  let value = initialValue;
  const observable: IObservable = new Observable();

  let comparator = options?.comparator ?? defaultComparator;
  if (comparator === 'deep') {
    const globalDeepComparator = scheduler.deepComparator;
    if (!globalDeepComparator) {
      throw new Error('[signal]: deep comparator not found');
    }
    comparator = globalDeepComparator;
  } else if (comparator === 'shallow') {
    comparator = defaultComparator;
  }

  function getter(): T {
    observable.track();
    return value;
  }

  getter.set = (nextValue: T) => {
    if (!comparator(value, nextValue)) {
      let originalValue = value;
      value = nextValue;
      if (scheduler.taskStatus === ETaskStatus.IDLE) {
        observable.trigger();
      } else if (!observable.isInQueue) {
        scheduler.dirtyObservables.add({ observable, originalValue, comparator, valueOf: () => value });
        observable.isInQueue = true;
      }
    }
  };

  return getter;
}
