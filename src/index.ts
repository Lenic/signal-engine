import { scheduler } from './core';
import { GlobalComparatorOptions } from './utils';

export * from './effect';
export * from './signal';
export * from './memo';
export * from './core';
export * from './utils';

/**
 * Runs a task in the scheduler's context.
 * @param action The task to run.
 */
export function batch(action: () => void): void {
  scheduler.batch(action);
}

/**
 * Sets the global deep comparator.
 * @param comparator The comparator function.
 */
export function setGlobalDeepComparator(comparator: (a: unknown, b: unknown) => boolean): void {
  GlobalComparatorOptions.deepComparator = comparator;
}
