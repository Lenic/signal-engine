import { SIGNAL_DEBUG_META } from './constants';
import { ESignalType, IObservable, ISubscriber, Observable, scheduler, Subscriber } from './core';
import { IReadonlySignalValue, ISignalValueOptions } from './types';
import { Comparable, Disposable, IComparable, IDisposable } from './utils';

/**
 * Creates a computed signal that lazily evaluates and memoizes the result of the provided function.
 *
 * The function is evaluated only when the signal is read and its dependencies have changed.
 * This ensures that unnecessary re-evaluations are avoided, making it highly efficient.
 *
 * @param fn The function to compute the signal's value.
 * @param options Options for creating the signal, including a comparator function.
 * @returns A read-only signal representing the memoized value.
 */
export function memo<T>(fn: () => T, options?: ISignalValueOptions): IReadonlySignalValue<T> & IDisposable {
  let isDirty = true;
  let isInitial = true;
  const disposable = new Disposable();
  const comparator: IComparable<T> = new Comparable<T>(options?.comparator);

  function refreshValue() {
    const nextValue = fn();
    if (!comparator.equal(nextValue)) {
      comparator.set(nextValue);
      observable.upgradeVersion();
    }
  }

  const observable: IObservable = new Observable({
    type: ESignalType.MEMO,
    name: options?.name ? `memo(${options.name})-observable` : undefined,
    refreshVersionAction: () => {
      if (isDirty) {
        isDirty = false;
        scheduler.untrack(refreshValue);
      }
    },
  });

  const subscriber: ISubscriber = new Subscriber(
    () => {
      isDirty = true;
      observable.trigger();
      subscriber.setConnectorNode(null);
    },
    {
      type: ESignalType.MEMO,
      name: options?.name ? `memo(${options.name})-effect` : undefined,
    },
  );
  disposable.disposeWithMe(subscriber);

  function memoFn(): T {
    if (isDirty || isInitial) {
      isDirty = false;
      subscriber.run(() => {
        let isChanged = isInitial;
        if (!isChanged) {
          let node = subscriber.dependencies.head;
          while (node) {
            if (node.value.observable.getVersion() > node.value.lastObservableVersion) {
              isChanged = true;
              break;
            }
            node = node.next;
          }
          if (!isChanged) return;
        }

        refreshValue();
      });
      isInitial = false;
    }

    observable.track();
    return comparator.value;
  }

  const result = memoFn as IReadonlySignalValue<T> & IDisposable;
  result.dispose = () => void disposable.dispose();
  result.disposeWithMe = (fn) => void disposable.disposeWithMe(fn);
  result[SIGNAL_DEBUG_META] = {
    type: 'memo',
    get dirty() {
      return isDirty;
    },
    get value() {
      return comparator.value;
    },
    name: options?.name,
    observable,
    subscriber,
  };

  return result;
}
