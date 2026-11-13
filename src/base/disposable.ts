import type { IDisposable } from './types';

import { BatchScope } from './batch';
import { ErrorScope } from './error';

export class Disposable implements IDisposable {
  private _isDisposed: boolean;

  protected constructor() {
    this._isDisposed = false;
  }

  get isDisposed() {
    return this._isDisposed;
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;

    const batchLevel = BatchScope.isBatching ? undefined : BatchScope.begin();
    const errorLevel = ErrorScope.isActive ? undefined : ErrorScope.begin();

    try {
      this.disposeWithErrorContext();
    } catch (e) {
      ErrorScope.record(e);
    }

    try {
      if (errorLevel !== undefined) ErrorScope.end(errorLevel);
    } finally {
      if (batchLevel !== undefined) BatchScope.end(batchLevel);
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
