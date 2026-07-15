import { ConnectorManager, globalScheduler, Schedulable, VersionFollower } from './core';

export function effect(action: () => void) {
  const task = new Schedulable();
  const follower = new VersionFollower(true);
  const manager = new ConnectorManager(follower, () => {
    task.clearScheduled();

    action();
  });

  function dispose() {
    task.dispose();
    follower.dispose();
    manager.dispose();
  }

  task.onScheduleChange((scheduled) => {
    if (scheduled) {
      globalScheduler.scheduledConnectorManagerList.append(manager);
    }
  });

  let iterativeCount = 0;
  follower.onDirty(() => {
    follower.clearDirty();

    iterativeCount += 1;
    if (iterativeCount > 100) {
      throw new Error('[effect]: Maximum iteration limit exceeded.');
    }

    if (globalScheduler.isRunning) {
      task.markScheduled();
    } else {
      manager.run();
    }
  });

  return dispose;
}
