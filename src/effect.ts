import {
  ConnectorManager,
  globalScheduler,
  IConnectorManager,
  IObjectOptions,
  Schedulable,
  VersionFollower,
} from './core';
import { IEffectAction, IEffectCleanup } from './types';
import { ILinkedNode } from './utils';

export function effect(action: IEffectAction, options?: IObjectOptions): IEffectCleanup {
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
      // A returned function is this run's cleanup. Adopting it binds it to this run, so it is
      // released right before the next recomputation and once more on disposal. Registered
      // after the action, which means an action that disposed itself mid-run leaves nothing
      // behind - `adopt` is a no-op by then.
      const cleanup = action();
      if (typeof cleanup === 'function') {
        manager.adopt(cleanup);
      }
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

  task.onScheduleChange = (scheduled) => {
    if (scheduled) {
      node = globalScheduler.scheduledConnectorManagerList.append(manager);
      // Leaving the queue *is* the scheduled run being consumed, and that happens whether or
      // not `run()` ends up finding anything to recompute. Clearing the flag here rather than
      // from inside the action keeps it honest when the action is skipped - otherwise the task
      // stays marked forever and every later `markScheduled()` is silently a no-op.
      node.onRemoved = () => {
        node = null;
        task.clearScheduled();
      };
    } else {
      node = null;
    }
  };

  follower.onDirty = () => {
    follower.clearDirty();

    if (globalScheduler.isRunning) {
      task.markScheduled();
    } else {
      manager.run();
    }
  };

  // The first execution belongs to `effect()` itself, not to the scheduler: by the time this
  // returns, the body has run and its dependencies are subscribed. Batching only governs
  // *re-runs* triggered by a dependency change.
  try {
    manager.run();
  } catch (error) {
    // The error escapes before the caller ever receives `dispose`, so an effect left standing
    // here would stay subscribed with nothing able to reach it. Tear it down first, then report.
    dispose();

    throw error;
  }

  return dispose;
}
