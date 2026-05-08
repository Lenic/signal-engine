import { scheduler, Subscriber } from '../core';

/**
 * Creates an effect that runs the given function and automatically disposes when the function is no longer needed.
 * @param fn The function to run as an effect.
 * @returns A function to dispose of the effect.
 */
export function effect(fn: () => void) {
  const subscriber = new Subscriber(fn);

  scheduler.run(subscriber, fn);

  return () => subscriber.dispose();
}
