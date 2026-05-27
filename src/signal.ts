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

  const fn = comparator;
  function getter(...args: any[]): any {
    // No arguments: act as getter
    if (args.length === 0) {
      observable.track();
      return value;
    }
    // Arguments provided: act as setter
    const [nextValue] = args as [T];
    if (!fn(value, nextValue)) {
      const originalValue = value;
      value = nextValue;
      if (scheduler.taskStatus === ETaskStatus.IDLE) {
        observable.trigger();
      } else if (!observable.isInQueue) {
        scheduler.dirtyObservables.add({ observable, originalValue, comparator: fn, valueOf: () => value });
        observable.isInQueue = true;
      }
    }
  }
  return getter as ISignalValue<T>;
}
