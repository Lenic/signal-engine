import { ConnectorManager, globalScheduler, IVersionLeader, VersionFollower, VersionLeader } from './core';
import { EqualComparer } from './utils';

export function memo<T>(fn: () => T) {
  let leader: IVersionLeader;
  const comparer = new EqualComparer<T>();

  const follower = new VersionFollower(true);
  follower.onDirty(() => leader.markDirty());

  const manager = new ConnectorManager(follower, () => {
    const nextValue = fn();
    if (comparer.setValue(nextValue)) {
      follower.clearDirty();
    }
  });

  leader = new VersionLeader((instance) => {
    if (instance.isDirty) {
      manager.run();
      if (instance.isDirty) {
        follower.clearDirty();
        return false;
      }
      return true;
    }
    return false;
  }, false);

  function getter(): T {
    globalScheduler.connectorManager?.track(leader);
    return comparer.value;
  }
  return getter;
}
