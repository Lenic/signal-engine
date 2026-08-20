import { IDisposable } from './types';
import { isDisposable } from './utils';

/**
 * Base class for objects that hold resources and release them together.
 *
 * Extend this class, then register each resource with `disposeWithMe`. One call to `dispose()`
 * releases all of them, so subclasses do not need their own cleanup logic.
 */
export class Disposable implements IDisposable {
  private subscriptions: (IDisposable | (() => void))[] | null = null;

  /**
   * Whether this object has been disposed of.
   *
   * Once true, no more resources can be registered, and calling `dispose()` again does
   * nothing.
   */
  protected isDisposed = false;

  /**
   * Releases every registered resource, in the order it was registered.
   *
   * Calling this more than once is safe. Only the first call does the work. Later calls return
   * right away.
   *
   * If one resource throws while being released, the ones after it are skipped. The object still
   * ends up marked as disposed, so it never stays half alive.
   */
  dispose(): void {
    if (this.isDisposed) return;

    try {
      const list = this.subscriptions;
      if (list) {
        for (const entry of list) {
          if (isDisposable(entry)) {
            entry.dispose();
          } else {
            entry();
          }
        }
      }
    } finally {
      this.subscriptions = null;
      this.isDisposed = true;
    }
  }

  /**
   * Registers a resource to be released when this object is disposed.
   *
   * @param disposable A disposable object, or a function that does the cleanup itself.
   * @throws An error when this object is already disposed.
   */
  disposeWithMe(disposable: IDisposable | (() => void)): void {
    this.assertNotDisposed();

    (this.subscriptions ??= []).push(disposable);
  }

  /**
   * Throws when this object is already disposed. Does nothing otherwise.
   *
   * Use it at the start of any method that a disposed object can no longer serve. Failing loudly
   * is better than working on a dead object: a resource registered after `dispose()` would never
   * be released, and that leak is hard to find later.
   */
  protected assertNotDisposed() {
    if (this.isDisposed) {
      throw new Error('[Disposable]: Object is disposed.');
    }
  }
}
