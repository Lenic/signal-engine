/**
 * An object that holds resources and can release them later.
 *
 * Resources are things that keep working until you stop them, such as event listeners, timers,
 * and subscriptions. Call `dispose()` when you no longer need the object, so it lets them go.
 */
export interface IDisposable {
  /**
   * Releases every resource this object holds.
   *
   * Calling this more than once is safe. Only the first call does the work. Later calls do
   * nothing.
   */
  dispose(): void;

  /**
   * Attaches another resource to this object, so both are released together.
   *
   * When `dispose()` runs, it also releases everything registered here, in the order it was
   * registered.
   *
   * @param disposable A disposable object, or a function that does the cleanup itself.
   * @throws An error when this object is already disposed. Register resources before that point.
   */
  disposeWithMe(disposable: IDisposable | (() => void)): void;
}
