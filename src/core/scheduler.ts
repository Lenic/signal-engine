import { ErrorScope, IErrorScopeContext, LinkedList } from '../utils';
import { IConnectorManager, IPendingSignalUpdate, IScheduler } from './types';

let iterativeLevel = 0;

export const globalScheduler: IScheduler = {
  isRunning: false,
  pendingSignalUpdateList: new LinkedList<IPendingSignalUpdate>(),
  scheduledConnectorManagerList: new LinkedList<IConnectorManager>(),
  currentContext: null,
  settlePendingWrites(): void {
    // Nothing queued is by far the common case - outside a batch this list is always empty -
    // so the check keeps this affordable on a read path.
    if (this.pendingSignalUpdateList.size === 0) return;

    // Each write is caught on its own, so one failing comparer cannot strand the writes queued
    // behind it. Uses beginBatch/endBatch rather than ErrorScope directly: called from inside
    // endBatch's own flush loop, this reuses the context that loop is already holding open
    // instead of opening a separate nested one; called standalone from a memo read outside any
    // batch, it still gets a real scope of its own.
    const context = this.beginBatch();
    try {
      this.pendingSignalUpdateList.clear((v) => {
        try {
          v.flush();
        } catch (e) {
          context.push(e);
        }
      });
    } finally {
      this.endBatch(context);
    }
  },
  beginBatch(): IErrorScopeContext {
    iterativeLevel += 1;

    // Set only by the outermost call; every nested call returns this same reference instead of
    // opening its own, which is what makes error aggregation flat - a failure ten frames deep and
    // one at the top land in one context, reported together, instead of each frame wrapping and
    // rethrowing what the frame below it already wrapped.
    if (iterativeLevel === 1) {
      this.currentContext = ErrorScope.begin();
    }

    return this.currentContext!;
  },
  endBatch(context: IErrorScopeContext): void {
    try {
      // Checked *before* lowering the counter, against its value including this call - the same
      // moment `batch`'s old single-function version checked it, right after the frame's own work
      // had run but before that frame's `finalize` (here: the decrement below) executed. A nested
      // `v.run()` invoked from inside this very flush loop sees the counter still at that value,
      // so it takes this same branch as false and defers to us instead of racing its own loop
      // against ours over the same two lists.
      if (iterativeLevel === 1) {
        let flushRound = 0;
        while (this.pendingSignalUpdateList.size > 0 || this.scheduledConnectorManagerList.size > 0) {
          flushRound += 1;
          if (flushRound > 100) {
            // A circuit breaker, not merely a tripwire. Everything still queued belongs to the
            // cycle that refused to converge, and leaving it in place lets the next top-level
            // batch walk straight back into the same loop. Pending writes are still flushed, so
            // no signal is left with a wedged schedule; every queued recomputation is then
            // dropped, which also clears the schedule flag of each manager it holds. Pushed
            // rather than thrown directly, so it joins whatever this round already collected
            // instead of replacing it.
            try {
              this.settlePendingWrites();
            } catch (e) {
              context.push(e);
            }
            this.scheduledConnectorManagerList.clear();
            context.push(new Error('[Scheduler]: Maximum flush iteration limit exceeded.'));
            break;
          }

          try {
            this.settlePendingWrites();
          } catch (e) {
            context.push(e);
          }
          this.scheduledConnectorManagerList.clear((v) => {
            try {
              v.run();
            } catch (e) {
              context.push(e);
            }
          });
        }
      }
    } finally {
      iterativeLevel -= 1;

      // Only the call that brought the counter back to zero owns the shared context - every
      // level in between just leaves it alone, exactly as it left the flush loop alone above.
      if (iterativeLevel === 0) {
        this.currentContext = null;
        // Throws whatever the whole batch collected - from any frame that pushed into this
        // context, or from the flush loop above. The caller's own state (`isRunning`,
        // `connectorManager`, ...) at every level must already be restored by the time control
        // reaches here, since this can be the point that throws.
        ErrorScope.end(context);
      }
    }
  },
  batch(action: (context: IErrorScopeContext) => void, finalize?: () => void): void {
    const previousRunning = this.isRunning;
    this.isRunning = true;

    const context = this.beginBatch();
    try {
      try {
        action(context);
      } catch (e) {
        context.push(e);
      }

      try {
        finalize?.();
      } catch (e) {
        context.push(e);
      }
    } finally {
      this.isRunning = previousRunning;
      this.endBatch(context);
    }
  },
};
