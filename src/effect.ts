import { ESignalType, ISignalValueOptions, Subscriber } from './core';

/**
 * Creates an effect that runs the given function and automatically disposes when the function is no longer needed.
 * @param fn The function to run as an effect.
 * @returns A function to dispose of the effect.
 */
export function effect(fn: () => void, options?: Omit<ISignalValueOptions, 'comparator'>) {
  const subscriber = new Subscriber(fn, ESignalType.EFFECT, options?.name);

  subscriber.run();

  return () => subscriber.dispose();
}
