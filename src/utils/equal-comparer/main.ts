import type { IEqualComparer } from './types';

import { Disposable } from '../disposable';

export function defaultEqualComparer<T>(x: T, y: T): boolean {
  return x === y;
}

const DEFAULT_VALUE = Symbol('default_value');

export class EqualComparer<T> extends Disposable implements IEqualComparer<T> {
  private _name?: string;
  private _value: T | typeof DEFAULT_VALUE;
  private _comparer: (x: T, y: T) => boolean;

  constructor(comparer?: (x: T, y: T) => boolean, name?: string) {
    super();

    this._name = name;
    this._value = DEFAULT_VALUE;
    this._comparer = comparer ?? defaultEqualComparer;
  }

  get name(): string | undefined {
    return this._name;
  }

  get value(): T {
    if (this._value === DEFAULT_VALUE) {
      throw new Error('[EqualComparer]: must initialize first.');
    }
    return this._value;
  }

  setValue(candidate: T, force: boolean = false): boolean {
    this.assertNotDisposed();

    if (force) {
      this._value = candidate;
      return true;
    }

    if (this._value !== DEFAULT_VALUE) {
      if (this._value === candidate) return false;
      if (this._comparer(this._value, candidate)) return false;
    }

    this._value = candidate;
    return true;
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();

    this._name = undefined;
    this._value = undefined as unknown as T;
    this._comparer = undefined as unknown as (x: T, y: T) => boolean;
  }
}
