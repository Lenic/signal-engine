import { ErrorScope, IErrorScopeContext, LinkedList } from '../utils';
import { IConnectorManager, IScheduler } from './types';

let iterativeLevel = 0;

export const globalScheduler: IScheduler = {
  isRunning: false,
  scheduledConnectorManagerList: new LinkedList<IConnectorManager>(),
  batch(action: (context: IErrorScopeContext) => void, finalize?: () => void): void {
    const previous = this.isRunning;
    this.isRunning = true;

    ErrorScope.getInstance().run(
      (context) => {
        iterativeLevel += 1;

        context.capture(() => action(context));

        if (iterativeLevel !== 1) return;

        this.scheduledConnectorManagerList.clear((v) => context.capture(() => v.run()));
      },
      () => {
        iterativeLevel -= 1;
        this.isRunning = previous;

        finalize?.();
      },
    );
  },
};
