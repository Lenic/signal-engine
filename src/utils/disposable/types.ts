/**
 * Interface for objects that can be disposed of to release resources.
 */
export interface IDisposable {
  /**
   * Disposes of the resources held by this object.
   */
  dispose(): void;

  /**
   * Registers a disposable or a cleanup function to be executed when this object is disposed.
   * @param disposable The disposable or cleanup function.
   */
  disposeWithMe(disposable: IDisposable | (() => void)): void;
}
