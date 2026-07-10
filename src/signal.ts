import { globalScheduler, VersionLeader } from './core';
import { EqualComparer } from './utils';

export function signal<T>(initialValue: T) {
  const comparer = new EqualComparer();
  const leader = new VersionLeader((instance) => instance.isDirty, false);

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
  return getter;
}
