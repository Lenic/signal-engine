import { SIGNAL_DEBUG_META } from './constants';
import { ESignalType, IObservable, ISubscriber, Observable, Subscriber } from './core';
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
  let hasEffect = false;
  const disposable = new Disposable();
  const comparator: IComparable<T> = new Comparable<T>(options?.comparator);

  const observable: IObservable = new Observable({
    type: ESignalType.MEMO,
    name: options?.name ? `memo(${options.name})-observable` : undefined,
  });
  disposable.disposeWithMe(
    observable.subscribers.addHook((type, payload?) => {
      if (type === 'add') {
        if (!hasEffect && payload.type === ESignalType.EFFECT) {
          hasEffect = true;
        }
      } else if (type === 'clear') {
        hasEffect = false;
      } else {
        if (!hasEffect && payload.value.type !== ESignalType.EFFECT) {
          // do nothing...
        } else if (hasEffect && payload.value.type !== ESignalType.EFFECT) {
          // do nothing...
        } else {
          hasEffect = false;
          let node = observable.subscribers.head;
          while (node) {
            if (node.value.type === ESignalType.EFFECT) {
              hasEffect = true;
              break;
            }
            node = node.next;
          }
        }
      }
    }),
  );

  const subscriber: ISubscriber = new Subscriber(
    () => {
      if (hasEffect) {
        const newValue = fn();
        if (!comparator.equal(newValue)) {
          comparator.set(newValue);
          isDirty = false;
          observable.upgradeVersion();
          observable.trigger();
        }
      } else {
        isDirty = true;
        observable.trigger();
        subscriber.setConnectorNode(null);
      }
    },
    {
      type: ESignalType.MEMO,
      name: options?.name ? `memo(${options.name})-effect` : undefined,
    },
  );
  disposable.disposeWithMe(subscriber);

  function memoFn(): T {
    if (isDirty) {
      subscriber.run(() => {
        const nextValue = fn();
        if (!comparator.equal(nextValue)) {
          comparator.set(nextValue);
          observable.upgradeVersion();
        }
      });
      isDirty = false;
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
