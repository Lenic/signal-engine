import { IDisposable } from './types';
import { isDisposable } from './utils';

export class Disposable implements IDisposable {
  // Left unallocated until something is actually registered. Most objects in this engine never
  // register anything, and an eagerly created array is a meaningful share of their footprint.
  private subscriptionList: (IDisposable | (() => void))[] | null = null;

  protected isDisposed = false;

  dispose(): void {
    if (this.isDisposed) return;

    try {
      const list = this.subscriptionList;
      if (list) {
        // Entries are stored as handed in and unwrapped here, so registering a disposable does
        // not cost a wrapper closure per call.
        for (const entry of list) {
          if (isDisposable(entry)) {
            entry.dispose();
          } else {
            entry();
          }
        }
      }
    } finally {
      this.subscriptionList = null;
      this.isDisposed = true;
    }
  }

  disposeWithMe(disposable: IDisposable | (() => void)): void {
    this.checkDisposed();

    (this.subscriptionList ??= []).push(disposable);
  }

  /**
   * Check if the object is disposed
   */
  protected checkDisposed() {
    if (this.isDisposed) {
      throw new Error('[Disposable]: Object is disposed.');
    }
  }
}
