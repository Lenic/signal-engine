import { ConnectorManager, globalScheduler, IVersionLeader, VersionFollower, VersionLeader } from './core';
import { IMemoValue, ISignalOptions } from './types';
import { EqualComparer } from './utils';

export function memo<T>(fn: () => T, options?: ISignalOptions<T>): IMemoValue<T> {
  let leader: IVersionLeader;
  const comparer = new EqualComparer<T>();

  const follower = new VersionFollower({ name: options?.name ? `memo-follower-${options?.name}` : undefined });
  follower.onDirty(() => {
    follower.clearDirty();
    leader.markDirty();
  });

  const manager = new ConnectorManager<boolean>(
    follower,
    () => {
      const nextValue = fn();
      if (comparer.setValue(nextValue)) {
        follower.clearDirty();
        return true;
      }
      return false;
    },
    options?.name ? `memo-connector-manager-${options?.name}` : undefined,
  );

  leader = new VersionLeader({
    confirm: (instance) => (instance.isDirty ? manager.run() : false),
    isDirty: true,
    name: options?.name ? `memo-leader-${options?.name}` : undefined,
  });

  function memo_getter(): T {
    globalScheduler.connectorManager?.track(leader);

    leader.confirm();
    return comparer.value;
  }

  memo_getter.leader = leader;
  memo_getter.manager = manager;
  memo_getter.comparer = comparer;
  memo_getter.follower = follower;

  memo_getter.dispose = () => {
    comparer.dispose();
    follower.dispose();
    manager.dispose();
    leader.dispose();
  };

  return memo_getter;
}
