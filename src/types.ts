import { IObjectOptions } from './core';

export interface ISignalOptions<T> extends IObjectOptions {
  name?: string;
  comparer?: (a: T, b: T) => boolean;
}

export interface ISignalValue<T> {
  (): T;
  (newValue: T): void;
}
