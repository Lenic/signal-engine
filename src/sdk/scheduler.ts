import { ISubscriber } from './types';

/**
 * Global scheduler for managing reactive execution context, batching, and glitch-free updates.
 */
export class Scheduler {
  /** The currently active subscriber being executed. */
  static activeSubscriber: ISubscriber | null = null;

  /** Indicates whether multiple signal updates are currently being batched. */
  static isBatching: boolean = false;

  /** Queue of subscribers waiting to be executed. */
  private static updateQueue: ISubscriber[] = [];

  /** Indicates whether the update queue is currently being processed. */
  private static isProcessingQueue: boolean = false;

  /** Current depth of the effect execution stack to prevent infinite recursion. */
  private static effectStackDepth: number = 0;

  /** Maximum allowed depth for effect execution. */
  private static readonly MAX_STACK_DEPTH: number = 100;

  /** Tracks how many times a subscriber has run in the current synchronous cycle. */
  private static runCounter = new Map<ISubscriber, number>();

  /** Maximum allowed runs per cycle to detect circular dependencies. */
  private static readonly MAX_RUN_COUNT: number = 100;

  /**
   * Executes a task within the context of a specific subscriber.
   *
   * @param subscriber - The subscriber context to activate.
   * @param task - The task function to execute.
   */
  static runWithSubscriber(subscriber: ISubscriber, task: () => void): void {
    const previousSubscriber = this.activeSubscriber;
    this.activeSubscriber = subscriber;

    this.effectStackDepth++;
    if (this.effectStackDepth > this.MAX_STACK_DEPTH) {
      throw new Error('Circular dependency or infinite reactive loop detected');
    }

    try {
      task();
    } finally {
      this.effectStackDepth--;
      this.activeSubscriber = previousSubscriber;
    }
  }

  /**
   * Batches multiple updates together, delaying subscriber execution until the batch completes.
   *
   * @param action - The function containing multiple state updates.
   */
  static batch(action: () => void): void {
    const previousBatching = this.isBatching;
    this.isBatching = true;

    try {
      action();
    } finally {
      this.isBatching = previousBatching;

      if (!this.isBatching && !this.isProcessingQueue) {
        this.processQueue();
      }
    }
  }

  /**
   * Schedules a subscriber to be executed.
   *
   * @param subscriber - The subscriber to schedule.
   */
  static scheduleUpdate(subscriber: ISubscriber): void {
    if (!this.updateQueue.includes(subscriber)) {
      this.updateQueue.push(subscriber);
    }

    if (!this.isBatching && !this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Processes the queue of scheduled updates using topological sorting to ensure glitch-free execution.
   */
  private static processQueue(): void {
    this.isProcessingQueue = true;
    try {
      while (this.updateQueue.length > 0) {
        // Sort by rank: lower ranks (upstreams) run first
        this.updateQueue.sort((a, b) => a.rank - b.rank);
        const subscriber = this.updateQueue.shift()!;

        // Detect infinite loops in the queue logic
        const count = (this.runCounter.get(subscriber) || 0) + 1;
        if (count > this.MAX_RUN_COUNT) {
          throw new Error('Circular dependency or infinite reactive loop detected');
        }
        this.runCounter.set(subscriber, count);

        subscriber.run();
      }
    } catch (e) {
      // Clear queue on error to prevent hanging the system
      this.updateQueue.length = 0;
      throw e;
    } finally {
      this.isProcessingQueue = false;
      this.runCounter.clear();
    }
  }
}
