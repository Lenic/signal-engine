import { ErrorScope, IErrorScopeContext, LinkedList } from '../utils';
import { IConnectorManager, IScheduler } from './types';

let iterativeLevel = 0;

export const globalScheduler: IScheduler = {
  isRunning: false,
  pendingActionList: new LinkedList<() => void>(),
  scheduledConnectorManagerList: new LinkedList<IConnectorManager>(),
  batch(action: (context: IErrorScopeContext) => void, finalize?: () => void): void {
    const previous = this.isRunning;
    this.isRunning = true;

    ErrorScope.getInstance().run(
      (context) => {
        iterativeLevel += 1;

        context.capture(() => action(context));

        if (iterativeLevel !== 1) return;

        do {
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
      () => {
        iterativeLevel -= 1;
        this.isRunning = previous;

        finalize?.();
      },
    );
  },
};
