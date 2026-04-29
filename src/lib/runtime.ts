import { Subscriber } from './types';

/** The currently active subscriber being executed. */
export let activeSubscriber: Subscriber | null = null;

let effectStackDepth = 0;
const MAX_STACK_DEPTH = 100;

/** Batching and Scheduling state */
export let isBatching = false;
const updateQueue: Subscriber[] = [];
let isProcessingQueue = false;

/** Tracks how many times a subscriber has run in the current sync cycle. */
const runCounter = new Map<Subscriber, number>();
const MAX_RUN_COUNT = 100;

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
    
    // Process queue at the outermost batch call
    if (!isBatching && !isProcessingQueue) {
      processQueue();
    }
  }
}

/**
 * Schedules a subscriber to run, respecting the current batching and ranking context.
 */
export function scheduleUpdate(subscriber: Subscriber) {
  if (!updateQueue.includes(subscriber)) {
    updateQueue.push(subscriber);
  }

  if (!isBatching && !isProcessingQueue) {
    processQueue();
  }
}

/**
 * Processes the update queue by topological rank to ensure glitch-free execution.
 */
function processQueue() {
  isProcessingQueue = true;
  try {
    while (updateQueue.length > 0) {
      // Sort by rank: lower ranks (upstreams) run first
      updateQueue.sort((a, b) => a.rank - b.rank);
      const subscriber = updateQueue.shift()!;
      
      // Detect infinite loops in the queue logic
      const count = (runCounter.get(subscriber) || 0) + 1;
      if (count > MAX_RUN_COUNT) {
        throw new Error('Circular dependency or infinite reactive loop detected');
      }
      runCounter.set(subscriber, count);

      subscriber.run();
    }
  } catch (e) {
    // Clear queue on error to prevent hanging the system
    updateQueue.length = 0;
    throw e;
  } finally {
    isProcessingQueue = false;
    runCounter.clear();
  }
}
