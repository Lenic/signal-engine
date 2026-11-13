import type { IBatchSnapshot, IConnectible, IEffectAction, IEffectOwner, IRunnable } from './types';

import { BatchScope } from './batch';
import { Connector } from './connector';
import { ErrorScope } from './error';
import { SignalValue } from './signal';

const MAX_ITERATION_DEPTH = 100;

let inactiveEffectList: IEffectAction[] = [];

export const globalContext = {
  isEffectRunning: false,
  activeOwner: undefined as IEffectOwner | undefined,
  effectList: [] as IEffectAction[],
  batchSnapshots: [] as IBatchSnapshot[],
  activeEffect: undefined as IRunnable | undefined,
  track(source: IConnectible, sourceVersion: number): void {
    const effect = this.activeEffect;
    if (effect === undefined || effect.isDisposed) return;

    const runId = effect.runId;
    const current = effect.connectibleCurrent;

    if (source.lastRunnable === effect && source.lastRunId === runId) return;

    if (!current) {
      new Connector(source, effect, sourceVersion).appendToAll();
      effect.connectibleCurrent = undefined;
    } else {
      if (source === current.connectible) {
        current.connectibleVersion = sourceVersion;
      } else {
        current.updateConnectible(source, sourceVersion);
      }
      effect.connectibleCurrent = current.nextConnectible;
    }

    source.lastRunnable = effect;
    source.lastRunId = runId;
  },
  untracked<T>(fn: () => T) {
    const previousActiveEffect = this.activeEffect;
    const previousEffectRunning = this.isEffectRunning;
    const previousActiveOwner = this.activeOwner;
    this.activeEffect = undefined;
    this.isEffectRunning = false;
    this.activeOwner = undefined;
    try {
      return fn();
    } finally {
      this.activeEffect = previousActiveEffect;
      this.isEffectRunning = previousEffectRunning;
      this.activeOwner = previousActiveOwner;
    }
  },
};

function clearEffectList() {
  globalContext.effectList.forEach((v) => void (v.isEnqueued = false));
  globalContext.effectList.length = 0;
}

let isConsuming = false;
function consumeTail() {
  if (!(globalContext.batchSnapshots.length || globalContext.effectList.length)) return;

  globalContext.batchSnapshots.forEach(SignalValue.restoreFromBatch);
  globalContext.batchSnapshots.length = 0;

  if (isConsuming) return;
  isConsuming = true;

  try {
    let iterationLevel = 0;
    while (globalContext.effectList.length) {
      if (iterationLevel > MAX_ITERATION_DEPTH) {
        clearEffectList();

        throw new Error('[ConsumeTail]: more than the max iteration.');
      }
      iterationLevel += 1;

      const list = globalContext.effectList;
      globalContext.effectList = inactiveEffectList;
      inactiveEffectList = list;

      const errorLevel = ErrorScope.begin();
      try {
        for (const item of list) {
          item.isEnqueued = false;
          if (item.isDisposed) continue;

          try {
            item.run();
          } catch (e) {
            ErrorScope.record(e);
          }
        }
      } finally {
        list.length = 0;

        if (ErrorScope.hasError) {
          clearEffectList();
        }
        ErrorScope.end(errorLevel);
      }
    }
  } finally {
    isConsuming = false;
  }
}
BatchScope.onBeforeExit = consumeTail;
