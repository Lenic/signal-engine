import { globalScheduler, IPendingSignalUpdate, Schedulable, VersionLeader } from './core';
import { ISignalOptions, ISignalValue } from './types';
import { EqualComparer } from './utils';

interface IPendingSignalValueUpdate<T> extends IPendingSignalUpdate {
  targetValue: T;
}

const defaultPendingValue = Symbol('default_pending_value');

export function signal<T>(initialValue: T, options?: ISignalOptions<T>): ISignalValue<T> {
  const comparer = new EqualComparer(options?.comparer, options?.name ? `signal-comparer-${options?.name}` : undefined);
  const leader = new VersionLeader({
    isDirty: false,
    confirm: (instance) => instance.isDirty,
    name: options?.name ? `signal-leader-${options?.name}` : undefined,
  });
  const task = new Schedulable(options?.name ? `signal-schedulable-${options?.name}` : undefined);

  comparer.setValue(initialValue);

  let baselineValue: T;
  let updater: IPendingSignalValueUpdate<T> | null = null;
  let pendingValue: T | typeof defaultPendingValue = defaultPendingValue;

  task.onScheduleChange((scheduled) => {
    if (!scheduled) return;

    if (pendingValue === defaultPendingValue) {
      throw new Error('[signal]: Error new value.');
    }

    updater = {
      targetValue: pendingValue,
      flush() {
        task.clearScheduled();

        const entry = updater!;
        updater = null;

        if (!comparer.isEqual(baselineValue, entry.targetValue)) {
          leader.markDirty();
        }
      },
    };

    pendingValue = defaultPendingValue;
    globalScheduler.pendingSignalUpdateList.append(updater);
  });

  function signal_getter(...args: any[]): any {
    // No arguments: act as getter
    if (args.length === 0) {
      globalScheduler.connectorManager?.track(leader);
      return comparer.value;
    }
    // Arguments provided: act as setter
    const [nextValue] = args as [T];
    if (!globalScheduler.isRunning) {
      if (comparer.setValue(nextValue)) {
        leader.markDirty();
      }
    } else {
      if (!task.isScheduled) {
        baselineValue = comparer.value;
        pendingValue = nextValue;
        task.markScheduled();
      } else if (updater) {
        updater.targetValue = nextValue;
      }
      comparer.setValue(nextValue);
    }
  }

  signal_getter.task = task;
  signal_getter.leader = leader;
  signal_getter.comparer = comparer;

  return signal_getter;
}
