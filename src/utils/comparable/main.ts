import { IComparable, TComparator } from './types';
import { getEqualComparator } from './utils';

const DEFAULT_VALUE = Symbol('Comparable.defaultValue');

export class Comparable<T> implements IComparable<T> {
  private comparator: (a: T, b: T) => boolean;

  value: T;

  /**
   * Create a new instance of Comparable.
   * @param comparatorType The comparator type, the default value is `shallow`.
   * @param initialValue The initial value.
   */
  constructor(comparatorType?: TComparator, initialValue?: T) {
    this.value = initialValue ?? (DEFAULT_VALUE as unknown as T);
    this.comparator = getEqualComparator(comparatorType);
  }

  /**
   * Set the original value.
   * @param value The original value.
   */
  set(value: T): void {
    this.value = value;
  }

  /**
   * Checks if the original value is equal to the target value.
   * @param target The target value.
   * @returns `true` if the original value is equal to the target value, `false` otherwise.
   */
  equal(target: T): boolean {
    if (this.value === DEFAULT_VALUE) {
      throw new Error('[Comparable]: Please set the original value before using the comparator.');
    }

    return this.comparator(this.value, target);
  }

  reset(): void {
    this.value = DEFAULT_VALUE as unknown as T;
  }
}
