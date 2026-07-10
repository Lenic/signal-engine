import { ConnectorManager, globalScheduler, Schedulable, VersionFollower } from './core';

export function effect(fn: () => void) {
  const task = new Schedulable();
  const follower = new VersionFollower(true);
  const manager = new ConnectorManager(follower, fn);

  task.onScheduleChange((scheduled) => {
    if (scheduled) {
      const node = globalScheduler.scheduledConnectorManagerList.append(manager);
      node.onRemoved = () => task.clearScheduled();
    }
  });

  follower.onDirty(() => {
    if (globalScheduler.isRunning) {
      task.markScheduled();
    } else {
      manager.run();
    }
    follower.clearDirty();
  });
}
