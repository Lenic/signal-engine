import { Subscriber } from './types';

/** The currently active subscriber being executed. */
export let activeSubscriber: Subscriber | null = null;

let effectStackDepth = 0;
const MAX_STACK_DEPTH = 100;

/** Batching state */
let isBatching = false;
const pendingSubscribers = new Set<Subscriber>();

/**
 * Executes a subscriber's task while managing the global tracking context.
 */
export function runWithSubscriber(subscriber: Subscriber, task: () => void) {
  const previousSubscriber = activeSubscriber;
  activeSubscriber = subscriber;

  effectStackDepth++;
  if (effectStackDepth > MAX_STACK_DEPTH) {
    throw new Error('Circular dependency or infinite reactive loop detected');
  }

  try {
    task();
  } finally {
    effectStackDepth--;
    activeSubscriber = previousSubscriber;
  }
}

/**
 * Groups multiple signal updates together and triggers effects only once at the end.
 */
export function batch(action: () => void) {
  const previousBatching = isBatching;
  isBatching = true;

  try {
    action();
  } finally {
    isBatching = previousBatching;
    
    // Only trigger updates if we are at the outermost batch call
    if (!isBatching) {
      const subscribers = Array.from(pendingSubscribers);
      pendingSubscribers.clear();
      for (const subscriber of subscribers) {
        subscriber.run();
      }
    }
  }
}

/**
 * Schedules a subscriber to run, respecting the current batching context.
 */
export function scheduleUpdate(subscriber: Subscriber) {
  if (isBatching) {
    pendingSubscribers.add(subscriber);
  } else {
    subscriber.run();
  }
}
