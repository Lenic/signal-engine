import { IErrorScopeContext, ISyncResult } from './types';

/**
 * Collects the errors of a single `ErrorScope.run` call
 *
 * `push` and `capture` are the two ways to store an error - see `IErrorScopeContext` for what they
 * mean to a caller. `throwIfAny` is where everything stored gets reported, and it is the only
 * method here that throws on purpose.
 *
 * `open` and `close` mark the window in which this context accepts writes. Instances are pooled
 * and handed out again, so a write arriving outside that window would land in someone else's run;
 * `assertOpen` rejects it instead.
 */
class ErrorScopeContext implements IErrorScopeContext {
  private isOpen = false;
  private errors: any[] = [];

  push(error: any): void {
    this.assertOpen();

    this.errors.push(error);
  }

  capture(action: () => ISyncResult): void {
    this.assertOpen();

    try {
      action();
    } catch (e) {
      this.errors.push(e);
    }
  }

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  throwIfAny(): void {
    if (!this.errors.length) return;

    try {
      if (this.errors.length === 1) {
        throw this.errors[0];
      } else {
        throw new AggregateError(this.errors, '[ErrorScope]: multiple errors occurred.');
      }
    } finally {
      this.errors = [];
    }
  }

  private assertOpen(): void {
    if (!this.isOpen) {
      throw new Error('[ErrorScope]: context used outside its scope.');
    }
  }
}

let depth = 0;
const pool: ErrorScopeContext[] = [];

/**
 * Utility class for managing synchronous error scopes
 *
 * This class provides a mechanism to run a callback and collect any errors it produces.
 * It uses a pool of reusable context objects to minimize allocations.
 */
export class ErrorScope {
  private constructor() {}

  /**
   * Runs `callback` and stores the errors it produces. Throws them together at the end.
   *
   * `callback` gets a `context` object. Call `context.capture(step)` to run a step that may fail:
   * if the step throws, the error is stored and the next step still runs. Call `context.push(err)`
   * to store an error you already have. If `callback` itself throws, that error is stored too.
   *
   * `finalize` runs after `callback`, both when it succeeded and when it failed. Use it for
   * cleanup. If `finalize` throws, that error is stored as well.
   *
   * Then `run` throws what it stored. One error is thrown as it is. Two or more are wrapped in an
   * `AggregateError`. If nothing was stored, `run` throws nothing.
   *
   * Both callbacks must be synchronous. The `context` object only works while `run` is running.
   * An `async` callback returns early, at its first `await`, so `run` finishes and the context
   * stops working. Any `push` or `capture` after that point would throw. The `ISyncResult` return
   * type makes TypeScript reject an `async` callback, so you see this error while compiling
   * instead of while running.
   *
   * @param callback The work to run. It gets the `context` that stores errors for it.
   * @param finalize Cleanup to run after `callback`, whether it succeeded or failed.
   * @throws The stored error itself when there is only one, or an `AggregateError` holding all of
   * them when there are more. Nothing is thrown when no error was stored.
   */
  static run(callback: (context: IErrorScopeContext) => ISyncResult, finalize?: () => ISyncResult): void {
    // This method both takes a context and gives it back, so one can never happen without the
    // other. Contexts come from a pool instead of being created each time: `run` is called very
    // often, and creating a new context plus two closures on every call was most of its cost.
    const context = (pool[depth] ??= new ErrorScopeContext());
    depth += 1;
    context.open();

    try {
      try {
        callback(context);
      } catch (e) {
        context.push(e);
      }

      // Runs on both paths, and its own failure is reported alongside whatever the callback left.
      try {
        finalize?.();
      } catch (e) {
        context.push(e);
      }

      context.throwIfAny();
    } finally {
      context.close();
      depth -= 1;
    }
  }
}
