/**
 * Collects errors for one `ErrorScope.begin`/`end` scope.
 *
 * Normally an error stops your code right away. With this object you store the error instead, so
 * the rest of your work can still run: wrap a step that may fail in its own `try`/`catch` and
 * call `push` with whatever it caught. At the end, `end` throws everything stored this way,
 * together.
 *
 * This object only works while the scope that created it is still open. If you keep it and use it
 * later, `push` throws. That is on purpose: `begin` reuses these objects, so a late call would add
 * your error to a scope that belongs to someone else.
 */
export interface IErrorScopeContext {
  /**
   * Stores an error - one just caught from a step wrapped in its own `try`/`catch`, or one already
   * on hand some other way.
   *
   * @param error The error to store. It can be any value, not only an `Error`.
   */
  push: (error: any) => void;

  /**
   * Whether anything has been stored so far - by `push`, or by a step the scope's owner ran
   * without wrapping in its own `try`/`catch`.
   *
   * A step that only *might* still be worth doing once something upstream has already failed can
   * check this instead of relying on the failure to propagate as an exception.
   */
  readonly hasErrors: boolean;
}
