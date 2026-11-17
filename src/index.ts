import type { IValueOptions, IAction, INamedObject } from './base';

import { SignalValue, MemoValue, EffectAction, globalContext, BatchScope } from './base';

export * from './base';

export interface ISignalSource<T> {
  (): T;
  (nextValue: T): void;
}

export function signal<T>(value: T, options?: IValueOptions<T>): ISignalSource<T> {
  const instance = new SignalValue(value, options);

  return function signal(nextValue?: T) {
    if (!arguments.length) {
      return instance.value;
    } else {
      instance.setValue(nextValue as T);
    }
  } as ISignalSource<T>;
}

export function memo<T>(getter: IAction<[], T>, options?: IValueOptions<T>): () => T {
  const instance = new MemoValue(getter, options);
  return () => instance.value;
}

export function effect(action: IAction<[], void | IAction>, options?: INamedObject): () => void {
  const instance = new EffectAction(action, options);
  return () => instance.dispose();
}

export function beginBatch() {
  return BatchScope.begin();
}

export function endBatch(level: number) {
  BatchScope.end(level);
}

export function untrack<T>(fn: () => T) {
  return globalContext.untracked(fn);
}
