/**
 * A type that no promise can match.
 *
 * Every promise has a `then` method. This type says `then` must not exist, so no promise fits it.
 * It is only a building block for `ISyncResult`. You rarely need it on its own.
 */
export interface INotThenable {
  then?: never;
}

/**
 * What a synchronous callback is allowed to return.
 *
 * Use this as the return type of a callback that must finish before it returns. `void` alone is
 * not enough: TypeScript accepts a function that returns any value where a `() => void` function
 * is expected, so an `async` callback would pass. Adding `INotThenable` rules out promises, so
 * TypeScript rejects an `async` callback while compiling.
 *
 * A callback that returns nothing matches this type, and so does one that ends with `throw`. A
 * callback that returns some other value does not match, which is fine when that value is ignored
 * anyway.
 */
export type ISyncResult = void | INotThenable;

/**
 * Collects errors for one `ErrorScope.run` call.
 *
 * Normally an error stops your code right away. With this object you store the error instead, so
 * the rest of your work can still run. At the end, `run` throws everything you stored together.
 *
 * This object only works while the `run` call that created it is still running. If you keep it and
 * use it later, both methods throw. That is on purpose: `run` reuses these objects, so a late call
 * would add your error to a scope that belongs to someone else.
 */
export interface IErrorScopeContext {
  /**
   * Stores an error you already have.
   *
   * @param error The error to store. It can be any value, not only an `Error`.
   */
  push: (error: any) => void;

  /**
   * Runs `action` right away. If `action` throws, the error is stored and `capture` returns
   * normally, so the code after it still runs.
   *
   * Use this when several steps must all run, even if some of them fail.
   *
   * @param action The step to run. It must be synchronous. An `async` function returns before it
   * is done, so an error it throws later would escape instead of being stored. The `ISyncResult`
   * return type makes TypeScript reject one.
   */
  capture: (action: () => ISyncResult) => void;
}
