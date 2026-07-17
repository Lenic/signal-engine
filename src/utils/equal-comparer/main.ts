import { Disposable } from '../disposable';
import { IEqualComparer } from './types';

function defaultComparer<T>(x: T, y: T): boolean {
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
    this._comparer = comparer ?? defaultComparer;
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

  setValue(candidate: T): boolean {
    if (this._value !== DEFAULT_VALUE && this._comparer(this._value, candidate)) return false;

    this._value = candidate;
    return true;
  }
}
