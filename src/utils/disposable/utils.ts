import type { IDisposable } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDisposable(value: any): value is IDisposable {
  return typeof value?.dispose === 'function' && value.dispose.length === 0;
}
