import {
  ISignalValue,
  Observable,
  ISignalValueOptions,
  IObservable,
  scheduler,
  ETaskStatus,
  SIGNAL_DEBUG_META,
  getUniqueId,
  ESignalType,
} from './core';
import { Comparable, IComparable } from './utils';

/**
 * Creates a signal with the given initial value.
 * @param initialValue The initial value of the signal.
 * @param options Options for creating the signal, including a comparator function.
 * @returns A signal with the given initial value.
 */
export function signal<T>(initialValue: T, options?: ISignalValueOptions): ISignalValue<T> {
  const currentId = getUniqueId();
  const observable: IObservable = new Observable(ESignalType.SIGNAL);
  const comparator: IComparable<T> = new Comparable<T>(options?.comparator, initialValue);

  function getter(...args: T[]): any {
    if (args.length === 0) {
      observable.track();
      return comparator.value;
    }

    const [nextValue] = args;
    if (comparator.equal(nextValue)) return;

    const originalValue = comparator.value;
    comparator.set(nextValue);
    if (scheduler.status === ETaskStatus.IDLE) {
      observable.trigger();
    } else if (!observable.queue.isInQueue) {
      observable.queue.addToQueue({ observable, originalValue, comparator });
    }
  }

  getter[SIGNAL_DEBUG_META] = {
    type: ESignalType.SIGNAL,
    get value() {
      return comparator.value;
    },
    get id() {
      return currentId;
    },
    name: options?.name,
    observable,
  };
  return getter as ISignalValue<T>;
}
