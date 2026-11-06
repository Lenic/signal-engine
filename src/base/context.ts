import type { ILinkedList } from '../utils';

import type { IBatchSnapshot, IConnectable, IEffectAction, IEffectOwner, IRunnable } from './types';

import { LinkedList } from '../utils';

import { BatchScope } from './batch';
import { ErrorScope } from './error';
import { notifyListeners } from './utils';

const MAX_ITERATION_DEPTH = 100;

let inactiveEffectList: ILinkedList<IEffectAction> = new LinkedList<IEffectAction>();

export const globalContext = {
  isEffectRunning: false,
  activeOwner: undefined as IEffectOwner | undefined,
  effectList: new LinkedList<IEffectAction>() as ILinkedList<IEffectAction>,
  batchSnapshots: new LinkedList<IBatchSnapshot>() as ILinkedList<IBatchSnapshot>,
  activeEffect: undefined as IRunnable | undefined,
  // hot path: no try/finally -- every exit below records the read mark itself.
  track(source: IConnectable): void {
    const effect = this.activeEffect;
    if (effect === undefined || effect.isDisposed) return;

    const runId = effect.runId;
    const sourceVersion = source.version;
    const current = effect.currentConnect;

    if (!current) {
      // already connected during this run: nothing to append
      if (source.lastInstance === effect && source.lastRunId === runId) return;

      effect.connectors.append({
        instance: source,
        version: sourceVersion,
        node: source.addChangeListener(effect),
      });
      // the appended connector is the tail, so there is nothing left to reuse
      effect.currentConnect = null;
    } else {
      const value = current.value;
      if (source === value.instance) {
        value.version = sourceVersion;
      } else {
        value.node.removeSelf();
        if (source.lastInstance === effect && source.lastRunId === runId) {
          // a repeated read during this run: drop the stale slot instead of reusing it
          effect.currentConnect = current.next;
          current.removeSelf();
          return;
        }

        current.value = {
          instance: source,
          version: sourceVersion,
          node: source.addChangeListener(effect),
        };
      }
      effect.currentConnect = current.next;
    }

    source.lastInstance = effect;
    source.lastRunId = runId;
  },
  untracked<T>(fn: () => T) {
    // Reads are tracked by whichever manager is active, so clearing it suppresses tracking.
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

let isConsuming = false;
function consumeTail() {
  notifyListeners(globalContext.batchSnapshots, null);

  if (isConsuming) return;
  isConsuming = true;

  try {
    let iterationLevel = 0;
    while (globalContext.effectList.size) {
      if (iterationLevel > MAX_ITERATION_DEPTH) {
        while (globalContext.effectList.head) globalContext.effectList.head.removeSelf();

        throw new Error('[ConsumeTail]: more than the max iteration.');
      }
      iterationLevel += 1;

      // hot path: destructiong assignment is prohibited
      const list = globalContext.effectList;
      globalContext.effectList = inactiveEffectList;
      inactiveEffectList = list;

      const errorLevel = ErrorScope.begin();
      try {
        while (list.head) {
          try {
            const instance = list.head.value;
            list.head.removeSelf();
            instance.run();
          } catch (e) {
            ErrorScope.record(e);
          }
        }
      } finally {
        if (ErrorScope.hasError) {
          while (globalContext.effectList.head) globalContext.effectList.head.removeSelf();
        }
        ErrorScope.end(errorLevel);
      }
    }
  } finally {
    isConsuming = false;
  }
}
BatchScope.onBeforeExit = consumeTail;
