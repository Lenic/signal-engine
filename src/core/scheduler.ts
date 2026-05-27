import { LinkedList } from '../utils';
import { ETaskStatus, type IScheduler, type ISubscriber, type IPendingObservable } from './types';

export const scheduler: IScheduler = {
  deepComparator: null,
  activeSubscriber: null,
  taskStatus: ETaskStatus.IDLE,
  dirtySubscribers: new LinkedList<ISubscriber>(),
  dirtyObservables: new LinkedList<IPendingObservable>(),

  batch(action: () => void): void {
    const prev = this.taskStatus;
    this.taskStatus = ETaskStatus.RUNNING;
    try {
      action();
    } finally {
      this.taskStatus = prev;
      this.flushObservables();
      this.flushSubscribers();
    }
  },

  flushSubscribers(): void {
    const caughtErrors: any[] = [];
    while (true) {
      if (this.taskStatus !== ETaskStatus.IDLE) return;

      this.taskStatus = ETaskStatus.RUNNING;
      try {
        let node = this.dirtySubscribers.head;
        if (!node) break;

        while (node) {
          try {
            node.value.run();
          } catch (e) {
            caughtErrors.push(e);
          }

          const next = node.next;
          node.removeSelf();
          node = next;
        }
      } finally {
        this.taskStatus = ETaskStatus.IDLE;
      }
    }

    if (caughtErrors.length) {
      if (caughtErrors.length === 1) {
        throw caughtErrors[0];
      } else {
        throw new AggregateError(caughtErrors, 'Multiple errors occurred during effect execution');
      }
    }
  },

  flushObservables() {
    const caughtErrors: any[] = [];
    while (true) {
      if (this.taskStatus !== ETaskStatus.IDLE) return;

      this.taskStatus = ETaskStatus.UPDATING;
      try {
        let node = this.dirtyObservables.head;
        if (!node) break;

        while (node) {
          try {
            if (!node.value.comparator(node.value.originalValue, node.value.valueOf())) {
              node.value.observable.trigger();
            }
          } catch (e) {
            caughtErrors.push(e);
          } finally {
            node.value.observable.isInQueue = false;
          }

          const next = node.next;
          node.removeSelf();
          node = next;
        }
      } finally {
        this.taskStatus = ETaskStatus.IDLE;
      }
    }

    if (caughtErrors.length) {
      if (caughtErrors.length === 1) {
        throw caughtErrors[0];
      } else {
        throw new AggregateError(caughtErrors, 'Multiple errors occurred during trigger execution');
      }
    }
  },
};
