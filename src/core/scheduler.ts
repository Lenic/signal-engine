import { LinkedList } from '../utils';
import { ETaskStatus, type IScheduler, type ISubscriber } from './types';

export const scheduler: IScheduler = {
  activeSubscriber: null,
  taskStatus: ETaskStatus.IDLE,
  dirtySubscribers: new LinkedList<ISubscriber>(),

  batch(action: () => void): void {
    const prev = this.taskStatus;
    this.taskStatus = ETaskStatus.RUNNING;
    try {
      action();
    } finally {
      this.taskStatus = prev;
      this.flush();
    }
  },

  flush(): void {
    if (this.taskStatus !== ETaskStatus.IDLE) return;

    this.taskStatus = ETaskStatus.RUNNING;
    try {
      let subscriber = this.dirtySubscribers.head;
      while (subscriber) {
        subscriber.value.run();
        subscriber.removeSelf();
        subscriber = this.dirtySubscribers.head;
      }
    } finally {
      this.taskStatus = ETaskStatus.IDLE;
      // Re-run flush if more subscribers were added during execution
      if (this.dirtySubscribers.size > 0) {
        this.flush();
      }
    }
  },
};
