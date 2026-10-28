import type { IValueOptions, IAction, INamedObject } from './base';
import type { IBatchScopeContext } from './utils';

import { SignalValue, MemoValue, EffectAction, globalContext } from './base';
import { BatchScope } from './utils';

export * from './base';
export * from './utils';

export interface ISignalSource<T> {
  (): T;
  (nextValue: T): void;
}

export function signal<T>(value: T, options?: IValueOptions<T>) {
  const instance = new SignalValue(value, options);
  return function signal(...args: T[]) {
    if (!args.length) {
      return instance.value;
    } else {
      instance.setValue(args[0]);
    }
  };
}

export function memo<T>(getter: IAction<[], T>, options?: IValueOptions<T>) {
  const instance = new MemoValue(getter, options);
  return () => instance.value;
}

export function effect(action: IAction<[], void | IAction>, options?: INamedObject) {
  const instance = new EffectAction(action, options);
  return () => instance.dispose();
}

export function beginBatch() {
  return BatchScope.begin();
}

export function endBatch(context: IBatchScopeContext) {
  BatchScope.end(context);
}

export function untrack<T>(fn: () => T) {
  return globalContext.untracked(fn);
}
