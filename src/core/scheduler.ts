import { LinkedList } from '../utils';
import { ETaskStatus, IScheduler, ISubscriber, IPendingObservable } from './types';

export const scheduler: IScheduler = {
  activeSubscriber: null,
  status: ETaskStatus.IDLE,
  dirtySubscribers: new LinkedList<ISubscriber>(),
  dirtyObservables: new LinkedList<IPendingObservable>(),

  batch(action: () => void): void {
    const prev = this.status;
    this.status = ETaskStatus.UPDATING;
    try {
      action();
    } finally {
      this.status = prev;
      this.flushObservables();
      this.flushSubscribers();
    }
  },

  flushSubscribers(): void {
    flush(this, 'dirtySubscribers', (value) => value.run());
  },

  flushObservables(): void {
    flush(
      this,
      'dirtyObservables',
      (value) => {
        if (!value.comparator.equal(value.originalValue)) {
          value.observable.trigger();
        }
      },
      (value) => void value.observable.queue.removeFromQueue(),
    );
  },

  untrack(action: () => void): void {
    const prevStatus = this.status;
    const prevSubscribers = this.dirtySubscribers;
    const prevObservables = this.dirtyObservables;
    const prevActiveSubscriber = this.activeSubscriber;

    this.activeSubscriber = null;
    this.status = ETaskStatus.IDLE;
    this.dirtySubscribers = new LinkedList<ISubscriber>();
    this.dirtyObservables = new LinkedList<IPendingObservable>();
    try {
      action();
    } finally {
      this.status = prevStatus;
      this.dirtySubscribers = prevSubscribers;
      this.dirtyObservables = prevObservables;
      this.activeSubscriber = prevActiveSubscriber;
    }
  },
};

function flush(
  scheduler: IScheduler,
  listKey: 'dirtyObservables',
  action: (node: IPendingObservable) => void,
  finallyFn?: (node: IPendingObservable) => void,
): void;
function flush(
  scheduler: IScheduler,
  listKey: 'dirtySubscribers',
  action: (node: ISubscriber) => void,
  finallyFn?: (node: ISubscriber) => void,
): void;
function flush(scheduler: IScheduler, listKey: string, action: (node: any) => void, finallyFn?: (node: any) => void) {
  const caughtErrors: any[] = [];
  while (true) {
    if (scheduler.status !== ETaskStatus.IDLE) return;

    scheduler.status = listKey === 'dirtyObservables' ? ETaskStatus.UPDATING : ETaskStatus.RUNNING;
    try {
      let node = scheduler[listKey].head;
      if (!node) break;

      while (node) {
        try {
          action(node.value);
        } catch (e) {
          caughtErrors.push(e);
        } finally {
          finallyFn?.(node.value);
        }

        const next = node.next;
        node.removeSelf();
        node = next;
      }
    } finally {
      scheduler.status = ETaskStatus.IDLE;
    }
  }

  if (caughtErrors.length) {
    if (caughtErrors.length === 1) {
      throw caughtErrors[0];
    } else {
      throw new AggregateError(
        caughtErrors,
        `Multiple errors occurred during ${listKey === 'dirtyObservables' ? 'trigger' : 'effect'} execution`,
      );
    }
  }
}
