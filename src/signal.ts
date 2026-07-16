import { globalScheduler, VersionLeader } from './core';
import { ISignalOptions } from './types';
import { EqualComparer } from './utils';

export function signal<T>(initialValue: T, options?: ISignalOptions<T>) {
  const comparer = new EqualComparer(options?.comparer);
  const leader = new VersionLeader({
    isDirty: false,
    confirm: (instance) => instance.isDirty,
    name: options?.name ? `signal-leader-${options?.name}` : undefined,
  });

  comparer.setValue(initialValue);

  function getter(...args: any[]): any {
    // No arguments: act as getter
    if (args.length === 0) {
      globalScheduler.connectorManager?.track(leader);
      return comparer.value;
    }
    // Arguments provided: act as setter
    const [nextValue] = args as [T];
    if (comparer.setValue(nextValue)) {
      leader.markDirty();
    }
  }

  getter.comparer = comparer;
  getter.leader = leader;
  return getter;
}
