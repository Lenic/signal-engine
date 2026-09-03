import { IDisposable } from './types';
import { isDisposable } from './utils';

export class Disposable implements IDisposable {
  private subscriptions: (IDisposable | (() => void))[] | null = null;

  isDisposed = false;

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

  disposeWithMe(disposable: IDisposable | (() => void)): void {
    this.assertNotDisposed();

    (this.subscriptions ??= []).push(disposable);
  }

  protected assertNotDisposed() {
    if (this.isDisposed) {
      throw new Error('[Disposable]: Object is disposed.');
    }
  }
}
