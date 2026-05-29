/**
 * Represents the type of comparison to use.
 */
export type TComparator = 'deep' | 'shallow' | ((a: any, b: any) => boolean);

/**
 * Represents an entity that can be compared to another entity.
 */
export interface IComparable<T> {
  /**
   * The value of the entity.
   */
  readonly value: T;

  /**
   * Resets the value.
   */
  reset(): void;
  /**
   * Sets the value.
   * @param value The value.
   */
  set(value: T): void;
  /**
   * Checks if the value is equal to the target value.
   * @param target The target value.
   * @returns True if the value is equal to the target value, false otherwise.
   */
  equal(target: T): boolean;
}

/**
 * Options for the global comparator.
 */
export type TGlobalComparatorOptions = {
  /**
   * Deep comparator function for deep comparison.
   * If not provided, deep comparison will not be available.
   */
  deepComparator: null | ((a: any, b: any) => boolean);
};
