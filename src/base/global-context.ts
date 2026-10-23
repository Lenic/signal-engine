import type { ILinkedList } from '../utils';

import type {
  IBatchSnapshot,
  IChangeListenerSource,
  IConnectManager,
  IDirtyMarkable,
  IEffectAction,
  IEffectOwner,
  IVersioned,
} from './types';

import { BatchScope, ErrorScope, LinkedList } from '../utils';

import { notifyListeners } from './utils';

const MAX_ITERATION_DEPTH = 100;

let inactiveEffectList: ILinkedList<IEffectAction> = new LinkedList<IEffectAction>();

export const globalContext = {
  isEffectRunning: false,
  activeOwner: undefined as IEffectOwner | undefined,
  effectList: new LinkedList<IEffectAction>() as ILinkedList<IEffectAction>,
  batchSnapshots: new LinkedList<IBatchSnapshot>() as ILinkedList<IBatchSnapshot>,
  activeEffect: undefined as (IDirtyMarkable & IConnectManager) | undefined,
  track(source: IVersioned & IChangeListenerSource<IDirtyMarkable>): void {
    if (!this.activeEffect) return;

    const ctx = ErrorScope.begin();
    try {
      const effect = this.activeEffect;
      const sourceVersion = source.version;
      if (!effect.currentConnect) {
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
          effect.currentConnect.value = {
            instance: source,
            version: sourceVersion,
            node: source.addChangeListener(effect),
          };
        }
        effect.currentConnect = effect.currentConnect.next;
      }
    } catch (e) {
      ctx.push(e);
    } finally {
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
          const node = list.head;
          try {
            node.value.run();
          } catch (e) {
            errorContext.push(e);
          }
          node.removeSelf();
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
