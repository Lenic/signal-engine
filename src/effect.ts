import { ConnectorManager, globalScheduler, Schedulable, VersionFollower } from './core';

export function effect(action: () => void, name?: string) {
  const task = new Schedulable(name ? `effect-schedulable-${name}` : undefined);
  const follower = new VersionFollower({ name: name ? `effect-follower-${name}` : undefined });
  const manager = new ConnectorManager(
    follower,
    () => {
      task.clearScheduled();

      action();
    },
    name ? `effect-connector-manager-${name}` : undefined,
  );

  function dispose() {
    task.dispose();
    manager.dispose();
    follower.dispose();
  }
  dispose.task = task;
  dispose.follower = follower;
  dispose.manager = manager;

  task.onScheduleChange((scheduled) => {
    if (scheduled) {
      globalScheduler.scheduledConnectorManagerList.append(manager);
    }
  });

  let iterativeCount = 0;
  follower.onDirty(() => {
    follower.clearDirty();

    iterativeCount += 1;
    try {
      if (iterativeCount > 100) {
        throw new Error('[effect]: Maximum iteration limit exceeded.');
      }

      if (globalScheduler.isRunning) {
        task.markScheduled();
      } else {
        manager.run();
      }
    } finally {
      iterativeCount -= 1;
    }
  });

  return dispose;
}
