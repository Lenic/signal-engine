import { ErrorScope, IErrorScopeContext, LinkedList } from '../utils';
import { IConnectorManager, IPendingSignalUpdate, IScheduler } from './types';

let iterativeLevel = 0;

export const globalScheduler: IScheduler = {
  isRunning: false,
  pendingSignalUpdateList: new LinkedList<IPendingSignalUpdate>(),
  scheduledConnectorManagerList: new LinkedList<IConnectorManager>(),
  runBatched(action: () => void): void {
    // A nested batch adds nothing: it raises and lowers the same counter, restores `isRunning`
    // from true back to true, skips the flush loop outright, and its error scope only catches
    // an error to rethrow it. Whenever `isRunning` holds, a batch is already open around us -
    // it is set in `batch` itself and in `ConnectorManager.run` immediately before it opens one
    // - so running the action directly keeps the same guarantees for a fraction of the cost.
    if (this.isRunning) return void action();

    this.batch(action);
  },
  settlePendingWrites(): void {
    // Nothing queued is by far the common case - outside a batch this list is always empty -
    // so the check keeps this affordable on a read path.
    if (this.pendingSignalUpdateList.size === 0) return;

    // Each write is captured on its own, so one failing comparer cannot strand the writes
    // queued behind it.
    ErrorScope.run((context) => this.pendingSignalUpdateList.clear((v) => context.capture(() => v.flush())));
  },
  batch(action: (context: IErrorScopeContext) => void, finalize?: () => void): void {
    const previous = this.isRunning;
    this.isRunning = true;

    ErrorScope.run(
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
            context.capture(() => this.settlePendingWrites());
            this.scheduledConnectorManagerList.clear();

            throw new Error('[Scheduler]: Maximum flush iteration limit exceeded.');
          }

          context.capture(() => this.settlePendingWrites());
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
