import type { ILinkedList } from '../utils';

import type { IBatchSnapshot, IConnectable, IEffectAction, IEffectOwner, IRunnable } from './types';

import { BatchScope, ErrorScope, LinkedList } from '../utils';

import { notifyListeners } from './utils';

const MAX_ITERATION_DEPTH = 100;

let inactiveEffectList: ILinkedList<IEffectAction> = new LinkedList<IEffectAction>();

export const globalContext = {
  isEffectRunning: false,
  activeOwner: undefined as IEffectOwner | undefined,
  effectList: new LinkedList<IEffectAction>() as ILinkedList<IEffectAction>,
  batchSnapshots: new LinkedList<IBatchSnapshot>() as ILinkedList<IBatchSnapshot>,
  activeEffect: undefined as IRunnable | undefined,
  track(source: IConnectable): void {
    if (!this.activeEffect) return;
    if (this.activeEffect.isDisposed) return;

    const ctx = ErrorScope.begin();
    const effect = this.activeEffect;
    try {
      const sourceVersion = source.version;
      if (!effect.currentConnect) {
        if (source.lastInstance === effect && source.lastRunId === effect.runId) return;

        const connector = effect.connectors.append({
          instance: source,
          version: sourceVersion,
          node: source.addChangeListener(effect),
        });
        this.activeEffect.currentConnect = connector.next;
      } else {
        const { value } = effect.currentConnect;
        if (source === value.instance) {
          value.version = sourceVersion;
        } else {
          effect.currentConnect.value.node.removeSelf();
          if (source.lastInstance === effect && source.lastRunId == effect.runId) {
            const deprecated = effect.currentConnect;
            effect.currentConnect = effect.currentConnect.next;
            deprecated.removeSelf();
            return;
          } else {
            effect.currentConnect.value = {
              instance: source,
              version: sourceVersion,
              node: source.addChangeListener(effect),
            };
          }
        }
        effect.currentConnect = effect.currentConnect.next;
      }
    } catch (e) {
      ctx.push(e);
    } finally {
      source.lastInstance = effect;
      source.lastRunId = effect.runId;

      ErrorScope.end(ctx);
    }
  },
};

let isConsuming = false;
function consumeTail() {
  notifyListeners(globalContext.batchSnapshots, null, true);

  if (isConsuming) return;
  isConsuming = true;

  const errorContext = ErrorScope.begin();
  try {
    let iterationLevel = 0;
    while (globalContext.effectList.size) {
      if (iterationLevel > MAX_ITERATION_DEPTH) {
        throw new Error('[ConsumeTail]: more than the max iteration.');
      }
      iterationLevel += 1;

      // hot path: destructiong assignment is prohibited
      const list = globalContext.effectList;
      globalContext.effectList = inactiveEffectList;
      inactiveEffectList = list;

      while (list.size) {
        while (list.head) {
          try {
            const instance = list.head.value;
            list.head.removeSelf();
            instance.run();
          } catch (e) {
            errorContext.push(e);
          }
        }
      }
    }
  } catch (e) {
    errorContext.push(e);
  } finally {
    isConsuming = false;
    ErrorScope.end(errorContext);
  }
}
BatchScope.onBeforeExit = (depth: number) => {
  if (depth !== -1) return;
  consumeTail();
};
