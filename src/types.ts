import { IObjectOptions } from './core';

export interface ISignalOptions<T> extends IObjectOptions {
  name?: string;
  comparer?: (a: T, b: T) => boolean;
}

export interface ISignalValue<T> {
  (): T;
  (newValue: T): void;
}

export interface IMemoValue<T> {
  (): T;
  dispose(): void;
}

/**
 * Releases whatever the run that returned it set up. Runs once, either right before the next
 * recomputation or when the effect is disposed - whichever comes first.
 */
export type IEffectCleanup = () => void;

/**
 * The body of an `effect`. Returning a function registers it as this run's cleanup.
 */
export type IEffectAction = () => void | IEffectCleanup;
