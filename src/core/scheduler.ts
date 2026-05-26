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
    // 使用循环而非递归，以防在 flush 过程中再次加入脏订阅者导致无限递归
    // 捕获每个 effect 的异常，收集所有错误，随后统一抛出，以便调用方感知全部异常
    const caughtErrors: any[] = [];
    while (true) {
      if (this.taskStatus !== ETaskStatus.IDLE) return;

      this.taskStatus = ETaskStatus.RUNNING;
      try {
        let subscriber = this.dirtySubscribers.head;
        if (!subscriber) break; // 没有脏订阅者，退出循环
        while (subscriber) {
          try {
            subscriber.value.run();
          } catch (e) {
            // 记录错误并继续执行其它 effect，防止单个 effect 崩溃导致调度器停止工作
            console.error(e);
            caughtErrors.push(e);
          }
          const next = subscriber.next;
          subscriber.removeSelf();
          subscriber = next;
        }
      } finally {
        this.taskStatus = ETaskStatus.IDLE;
      }
    }
    if (caughtErrors.length) {
      // 若有多个错误，抛出 AggregateError（Node.js 原生支持），否则抛出单个错误
      if (caughtErrors.length === 1) {
        throw caughtErrors[0];
      } else {
        throw new AggregateError(caughtErrors, 'Multiple errors occurred during effect execution');
      }
    }
  },
};
