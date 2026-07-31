import {
  ConnectorManager,
  globalScheduler,
  IConnectorManager,
  IObjectOptions,
  Schedulable,
  VersionFollower,
} from './core';
import { ILinkedNode } from './utils';

export function effect(action: () => void, options?: IObjectOptions) {
  const { name } = options ?? {};

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

  let node: ILinkedNode<IConnectorManager> | null = null;
  function dispose() {
    node?.removeSelf();
    node = null;

    task.dispose();
    manager.dispose();
    follower.dispose();
  }

  dispose.task = task;
  dispose.manager = manager;
  dispose.follower = follower;

  task.onScheduleChange((scheduled) => {
    if (scheduled) {
      node = globalScheduler.scheduledConnectorManagerList.append(manager);
      node.onRemoved = () => void (node = null);
    } else {
      node = null;
    }
  });

  follower.onDirty(() => {
    follower.clearDirty();

    if (globalScheduler.isRunning) {
      task.markScheduled();
    } else {
      manager.run();
    }
  });

  return dispose;
}
