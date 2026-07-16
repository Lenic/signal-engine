import { globalScheduler, VersionLeader } from './core';
import { EqualComparer } from './utils';

export function signal<T>(initialValue: T, name?: string) {
  const comparer = new EqualComparer();
  const leader = new VersionLeader({
    isDirty: false,
    confirm: (instance) => instance.isDirty,
    name: name ? `signal-leader-${name}` : undefined,
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
