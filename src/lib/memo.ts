import { DependencyList, Memo, Subscriber } from './types';
import { track, trigger, stopSubscriber } from './effect';
import { activeSubscriber, runWithSubscriber } from './runtime';
import { removeFromDependencyList } from './linked-list';

/**
 * Creates a memoized reactive value.
 */
export function memo<T>(fn: () => T): Memo<T> {
  let cachedValue: T;
  let isDirty = true;
  const dependencyList: DependencyList = { head: null, tail: null };

  const subscriber: Subscriber = {
    run() {
      if (isDirty) return; // Already dirty, no need to trigger downstream again
      isDirty = true;
      trigger(dependencyList);
    },
    subscriptions: [],
    parent: activeSubscriber,
    children: [],
    active: true,
    trackingIndex: 0,
  };

  // Automatically track as a child if created inside an effect
  if (activeSubscriber) {
    activeSubscriber.children.push(subscriber);
  }

  const getter = (() => {
    track(dependencyList);

    if (isDirty) {
      subscriber.trackingIndex = 0;
      runWithSubscriber(subscriber, () => {
        cachedValue = fn();
      });

      // Cleanup unused subscriptions after computation
      if (subscriber.trackingIndex < subscriber.subscriptions.length) {
        for (let i = subscriber.trackingIndex; i < subscriber.subscriptions.length; i++) {
          removeFromDependencyList(subscriber.subscriptions[i]);
        }
        subscriber.subscriptions.length = subscriber.trackingIndex;
      }

      isDirty = false;
    }

    return cachedValue;
  }) as Memo<T>;

  // Expose manual disposal
  getter.dispose = () => stopSubscriber(subscriber);

  return getter;
}
