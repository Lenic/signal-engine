import { SIGNAL_DEBUG_META } from './constants';
import { Observable, IObservable, scheduler, ETaskStatus, ESignalType } from './core';
import { ISignalValue, ISignalValueOptions } from './types';
import { Comparable, IComparable } from './utils';

/**
 * Creates a signal with the given initial value.
 * @param initialValue The initial value of the signal.
 * @param options Options for creating the signal.
 * @returns A signal with the given initial value.
 */
export function signal<T>(initialValue: T, options?: ISignalValueOptions): ISignalValue<T> {
  const observable: IObservable = new Observable({
    type: ESignalType.SIGNAL,
    name: options?.name,
  });
  const comparator: IComparable<T> = new Comparable<T>(options?.comparator, initialValue);

  function signalFn(...args: T[]): any {
    if (args.length === 0) {
      observable.track();
      return comparator.value;
    }

    const [nextValue] = args;
    if (comparator.equal(nextValue)) return;

    const originalValue = comparator.value;
    comparator.set(nextValue);

    if (scheduler.status === ETaskStatus.IDLE) {
      observable.upgradeVersion();
      observable.trigger();
    } else if (!observable.queue.isInQueue) {
      observable.queue.addToQueue({ observable, originalValue, comparator });
    }
  }

  signalFn[SIGNAL_DEBUG_META] = {
    type: ESignalType.SIGNAL,
    get value() {
      return comparator.value;
    },
    name: options?.name,
    observable,
  };
  return signalFn as ISignalValue<T>;
}
