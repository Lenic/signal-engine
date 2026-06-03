import { SIGNAL_DEBUG_META } from './constants';
import { ESignalType, ISignalOptions } from './core';

/**
 * Meta data for signal debugging.
 */
export interface ISignalMeta extends Record<string, unknown> {
  /**
   * Type of the signal.
   */
  readonly type: ESignalType;
  /**
   * The signal name.
   */
  readonly name?: string;
  /**
   * The current value of the signal.
   */
  readonly value: any;
}

/**
 * Represents a read-only signal value that can be read.
 */
export interface IReadonlySignalValue<T> {
  /**
   * Gets the meta data for debugging.
   */
  [SIGNAL_DEBUG_META]: ISignalMeta;
  /**
   * Gets the current value of the signal.
   */
  (): T;
}

/**
 * Options for creating or updating a signal value.
 */
export interface ISignalValueOptions extends Omit<ISignalOptions, 'type'> {
  /**
   * The comparator function to use for comparing values.
   *
   * - `'deep'`: Deep comparison by the global default comparator.
   * - `'shallow'`: Shallow comparison by `===`.
   * - `(a: any, b: any) => boolean`: Custom comparator.
   */
  comparator?: 'deep' | 'shallow' | ((a: any, b: any) => boolean);
}

/**
 * Represents a writable signal value that can be read and updated.
 */
export interface ISignalValue<T> extends IReadonlySignalValue<T> {
  /**
   * Sets a new value for the signal.
   * @param value The new value to set.
   */
  (value: T, options?: ISignalValueOptions): void;
}
