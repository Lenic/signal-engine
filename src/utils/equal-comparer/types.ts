import { IDisposable } from '../disposable';

export interface IEqualComparer<T> extends IDisposable {
  readonly value: T;
  readonly name?: string;

  setValue(candidate: T): boolean;
}
