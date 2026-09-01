import { IErrorScopeContext } from './types';

/**
 * Thrown by a step that already found `context.hasErrors` true and wants its caller to stop
 * rather than proceed on a value it can no longer trust - reading a memo whose own recompute
 * just failed, for instance. It carries no information of its own: whatever actually went wrong
 * is already sitting in the context.
 *
 * `push` recognizes and drops it silently, so a step that catches this instead of letting it
 * propagate does not turn one failure into two. Throw it only when `hasErrors` is already true -
 * throwing it otherwise records nothing and the scope reports as if nothing happened.
 */
export class ScopeAbortSignal {
  private constructor() {}

  static readonly instance = new ScopeAbortSignal();
}

/**
 * Collects the errors of a single `ErrorScope.begin`/`end` scope
 *
 * `push` is how a caller stores an error - see `IErrorScopeContext` for what that means to it.
 * `throwIfAny` is where everything stored gets reported, and it is the only method here that
 * throws on purpose.
 *
 * `open` and `close` mark the window in which this context accepts writes. Instances are pooled
 * and handed out again, so a write arriving outside that window would land in someone else's scope;
 * `assertOpen` rejects it instead.
 */
class ErrorScopeContext implements IErrorScopeContext {
  private isOpen = false;
  private errors: any[] = [];

  get hasErrors(): boolean {
    this.assertOpen();

    return this.errors.length > 0;
  }

  push(error: any): void {
    this.assertOpen();

    if (error === ScopeAbortSignal.instance) return;

    this.errors.push(error);
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
 * This class provides a mechanism to collect the errors a piece of work produces, across
 * however many synchronous frames that work spans, and report them together. It uses a pool of
 * reusable context objects to minimize allocations.
 */
export class ErrorScope {
  private constructor() {}

  /**
   * Opens a scope and hands back the context that collects its errors, without also deciding
   * when the scope ends.
   *
   * Pairs with `end`. Every caller wraps its own work in a plain `try`/`finally` around the two:
   * `try`/`catch` each step that may fail, calling `context.push(err)` with whatever it caught,
   * then call `end` in the `finally`. Exists in two parts, rather than fused into one call the
   * way an `ErrorScope.run(callback, finalize)` once was, because a caller that recurses through
   * several synchronous frames before it can close the scope - `ConnectorManager.run()`
   * confirming a chain of dependencies, `markDirty()` propagating - would otherwise have to wrap
   * that entire recursion in a closure just to hand it to `run`, paying for that closure on every
   * frame. Calling `begin` once and threading the context through as a plain parameter avoids
   * that: nothing here allocates a closure - only the pooled context (as before), or an
   * `ErrorScopeContext` instance the first time a given depth is reached.
   *
   * @returns The context. Reused when `depth` matches something already in the pool, otherwise a
   * fresh instance is pooled at that depth. Feed it to `end` when the scope is done.
   */
  static begin(): IErrorScopeContext {
    const context = (pool[depth] ??= new ErrorScopeContext());
    depth += 1;
    context.open();

    return context;
  }

  /**
   * Closes a scope opened by `begin`, throwing whatever it collected.
   *
   * @param context The context `begin` returned. Passing anything else is a caller bug - contexts
   * are only ever manufactured by `begin`.
   * @throws The stored error itself when there is only one, or an `AggregateError` holding all of
   * them when there are more. Nothing is thrown when no error was stored.
   */
  static end(context: IErrorScopeContext): void {
    const internal = context as ErrorScopeContext;

    try {
      internal.throwIfAny();
    } finally {
      internal.close();
      depth -= 1;
    }
  }
}
