import { IDisposable } from './types';

/**
 * Whether it is a disposable
 * @param disposable - The disposable to check
 * @returns Whether it is a disposable
 */
export function isDisposable(disposable: any): disposable is IDisposable {
  return (
    'dispose' in disposable &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    typeof disposable.dispose === 'function' &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    disposable.dispose.length === 0
  );
}
