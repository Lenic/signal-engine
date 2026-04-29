import { DependencyList, Subscriber } from './types';
import { activeSubscriber, runWithSubscriber, scheduleUpdate, batch } from './runtime';
import {
  appendToDependencyList,
  createDependencyNode,
  removeFromDependencyList,
  forEachSubscriber,
} from './linked-list';

/**
 * Creates a reactive effect.
 */
export function effect(fn: () => void): () => void {
  const subscriber: Subscriber = {
    run() {
      if (!this.active) return;

      // Stop and clear child effects before re-running
      for (const child of this.children) {
        stopSubscriber(child);
      }
      this.children = [];

      this.trackingIndex = 0;
      runWithSubscriber(this, fn);

      // Cleanup unused subscriptions after the run
      if (this.trackingIndex < this.subscriptions.length) {
        for (let i = this.trackingIndex; i < this.subscriptions.length; i++) {
          removeFromDependencyList(this.subscriptions[i]);
        }
        this.subscriptions.length = this.trackingIndex;
      }
    },
    subscriptions: [],
    parent: activeSubscriber,
    children: [],
    active: true,
    trackingIndex: 0,
    rank: 0,
  };

  if (activeSubscriber) {
    activeSubscriber.children.push(subscriber);
  }

  subscriber.run();

  return () => stopSubscriber(subscriber);
}

/**
 * Clears all existing subscriptions for a subscriber.
 */
export function cleanupSubscriber(subscriber: Subscriber) {
  for (const node of subscriber.subscriptions) {
    removeFromDependencyList(node);
  }
  subscriber.subscriptions = [];

  // Stop and clear child effects
  for (const child of subscriber.children) {
    stopSubscriber(child);
  }
  subscriber.children = [];
}

/**
 * Permanently stops a subscriber from being reactive.
 */
export function stopSubscriber(subscriber: Subscriber) {
  if (!subscriber.active) return;
  subscriber.active = false;
  cleanupSubscriber(subscriber);
}

/**
 * Links the active subscriber to a dependency source.
 */
export function track(list: DependencyList) {
  if (!activeSubscriber) return;

  const subscriber = activeSubscriber;
  const index = subscriber.trackingIndex++;

  // 🚀 RANK PROPAGATION:
  // Ensure the subscriber's rank is always greater than its dependency's rank.
  if (subscriber.rank <= list.rank) {
    subscriber.rank = list.rank + 1;
  }

  // 🚀 REUSE OPTIMIZATION:
  // If the dependency at this index is the same, reuse it and avoid object creation.
  if (subscriber.subscriptions[index]?.dependencyList === list) {
    return;
  }

  const newNode = createDependencyNode(subscriber, list);

  // If there was an old node at this index, remove it first
  if (subscriber.subscriptions[index]) {
    removeFromDependencyList(subscriber.subscriptions[index]);
    subscriber.subscriptions[index] = newNode;
  } else {
    subscriber.subscriptions.push(newNode);
  }

  appendToDependencyList(list, newNode);
}

/**
 * Triggers updates for all subscribers in a dependency list.
 */
export function trigger(list: DependencyList) {
  batch(() => {
    forEachSubscriber(list, (node) => {
      if (node.subscriber) {
        scheduleUpdate(node.subscriber);
      }
    });
  });
}
