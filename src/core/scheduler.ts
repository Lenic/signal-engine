import { ErrorScope, IErrorScopeContext, LinkedList } from '../utils';
import { IConnectorManager, IPendingSignalUpdate, IScheduler } from './types';

let iterativeLevel = 0;

export const globalScheduler: IScheduler = {
  isRunning: false,
  pendingSignalUpdateList: new LinkedList<IPendingSignalUpdate>(),
  scheduledConnectorManagerList: new LinkedList<IConnectorManager>(),
  batch(action: (context: IErrorScopeContext) => void, finalize?: () => void): void {
    const previous = this.isRunning;
    this.isRunning = true;

    ErrorScope.getInstance().run(
      (context) => {
        iterativeLevel += 1;

        context.capture(() => action(context));

        if (iterativeLevel !== 1) return;

        let flushRound = 0;
        while (this.pendingSignalUpdateList.size > 0 || this.scheduledConnectorManagerList.size > 0) {
          flushRound += 1;
          if (flushRound > 100) {
            // A circuit breaker, not merely a tripwire. Everything still queued belongs to the
            // cycle that refused to converge, and leaving it in place lets the next top-level
            // batch walk straight back into the same loop. Pending writes are still flushed, so
            // no signal is left with a wedged schedule; every queued recomputation is then
            // dropped, which also clears the schedule flag of each manager it holds.
            this.pendingSignalUpdateList.clear((v) => context.capture(() => v.flush()));
            this.scheduledConnectorManagerList.clear();

            throw new Error('[Scheduler]: Maximum flush iteration limit exceeded.');
          }

          this.pendingSignalUpdateList.clear((v) => context.capture(() => v.flush()));
          this.scheduledConnectorManagerList.clear((v) => context.capture(() => v.run()));
        }
      },
      () => {
        iterativeLevel -= 1;
        this.isRunning = previous;

        finalize?.();
      },
    );
  },
};
