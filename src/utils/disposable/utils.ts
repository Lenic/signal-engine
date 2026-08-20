import { IDisposable } from './types';

/**
 * Checks whether a value is a disposable object.
 *
 * A value is disposable when it has a `dispose` method that takes no arguments.
 * Everything else returns `false`, including `null`, `undefined`, and primitive
 * values such as numbers and strings. This function never throws.
 *
 * @param value The value to check
 * @returns `true` if the value has a `dispose()` method that takes no arguments
 */
export function isDisposable(value: any): value is IDisposable {
  return typeof value?.dispose === 'function' && value.dispose.length === 0;
}
