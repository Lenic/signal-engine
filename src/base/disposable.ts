import type { IDisposable } from './types';

import { ErrorScope } from './error';

export class Disposable implements IDisposable {
  isDisposed: boolean;

  protected constructor() {
    this.isDisposed = false;
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    const errorLevel = ErrorScope.isActive ? undefined : ErrorScope.begin();

    try {
      this.disposeWithErrorContext();
    } catch (e) {
      ErrorScope.record(e);
    } finally {
      if (errorLevel !== undefined) ErrorScope.end(errorLevel);
    }
  }

  protected assertNotDisposed() {
    if (this.isDisposed) {
      throw new Error('[Disposable]: Object is disposed.');
    }
  }

  protected disposeWithErrorContext() {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDisposable(value: any): value is IDisposable {
  return typeof value?.dispose === 'function' && value.dispose.length === 0;
}
