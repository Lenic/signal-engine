import { ErrorScope, LinkedList } from '../utils';
import { IConnectorManager, IScheduler } from './types';

export const globalScheduler: IScheduler = {
  isRunning: false,
  pendingActionList: new LinkedList<() => void>(),
  scheduledConnectorManagerList: new LinkedList<IConnectorManager>(),
  batch: function (action: () => void): void {
    const previous = this.isRunning;
    this.isRunning = true;

    ErrorScope.current.run(
      (context) => {
        context.capture(action);

        let count = 0;
        do {
          if (count > 10) {
            throw new Error('[IScheduler.batch]: Maximum iteration limit exceeded.');
          }

          let n1 = this.pendingActionList.head;
          while (n1) {
            context.capture(n1.value);

            n1.removeSelf();
            n1 = this.pendingActionList.head;
          }

          let n2 = this.scheduledConnectorManagerList.head;
          while (n2) {
            context.capture(() => n2!.value.run());

            n2.removeSelf();
            n2 = this.scheduledConnectorManagerList.head;
          }
        } while (this.pendingActionList.size > 0 || this.scheduledConnectorManagerList.size > 0);
      },
      () => void (this.isRunning = previous),
    );
  },
};
