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

  // Whoever is executing right now adopts this effect: it gets disposed before that owner
  // recomputes and when the owner itself is disposed. At the top level there is no owner,
  // so the caller is the only one holding the returned `dispose`.
  const owner = globalScheduler.connectorManager;

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

  // Handed over before the first run, so a nested effect that throws on its initial
  // execution is still tracked by its owner instead of leaking.
  owner?.adopt(dispose);

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
