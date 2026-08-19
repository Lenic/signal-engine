import { globalScheduler } from './core';

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
  globalScheduler.batch(action);
}
