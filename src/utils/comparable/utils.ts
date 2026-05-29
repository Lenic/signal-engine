import { GlobalComparatorOptions } from './constants';
import { TComparator } from './types';

function defaultComparator(a: any, b: any) {
  return a === b;
}

/**
 * Get the equal comparator.
 * @param comparatorType The comparator type.
 * @returns The equal comparator function.
 */
export function getEqualComparator(comparatorType?: TComparator): (a: any, b: any) => boolean {
  let comparator = comparatorType ?? defaultComparator;

  if (comparator === 'deep') {
    const globalDeepComparator = GlobalComparatorOptions.deepComparator;
    if (!globalDeepComparator) {
      throw new Error('[GlobalComparatorOptions]: deep comparator not found');
    }
    comparator = globalDeepComparator;
  } else if (comparator === 'shallow') {
    comparator = defaultComparator;
  }

  return comparator;
}
