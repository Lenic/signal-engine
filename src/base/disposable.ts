import type { IDisposable } from './types';

export abstract class Disposable implements IDisposable {
  isDisposed: boolean;

  protected constructor() {
    this.isDisposed = false;
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.disposeWithErrorContext();
  }

  protected abstract disposeWithErrorContext(): void;
}
