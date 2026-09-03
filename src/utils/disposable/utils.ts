import { IDisposable } from './types';

export function isDisposable(value: any): value is IDisposable {
  return typeof value?.dispose === 'function' && value.dispose.length === 0;
}
