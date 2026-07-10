import { IDisposable } from '../disposable';

export interface IEqualComparer<T> extends IDisposable {
  readonly value: T;
  setValue(candidate: T): boolean;
}
