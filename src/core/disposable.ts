import { IDisposable } from './types';
import { isDisposable } from './utils';

export class Disposable implements IDisposable {
  private subscriptionList: (() => void)[] = [];

  protected isDisposed = false;

  dispose(): void {
    if (this.isDisposed) return;

    try {
      this.subscriptionList.forEach((fn) => void fn());
    } finally {
      this.subscriptionList = undefined as unknown as (() => void)[];
      this.isDisposed = true;
    }
  }

  disposeWithMe(disposable: IDisposable | (() => void)): void {
    this.checkDisposed();

    if (isDisposable(disposable)) {
      this.subscriptionList.push(() => void disposable.dispose());
    } else {
      this.subscriptionList.push(disposable);
    }
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
