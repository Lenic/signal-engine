import type { ILinkedList } from '../utils';

import type { IChangeListenerSource, IConnectManager, IDirtyMarkable, IEffectAction, IVersioned } from './types';

import { BatchScope, ErrorScope, LinkedList } from '../utils';

const MAX_ITERATION_DEPTH = 100;

let inactiveEffectList: ILinkedList<IEffectAction> = new LinkedList<IEffectAction>();

export const globalContext = {
  isEffectRunning: false,
  effectList: new LinkedList<IEffectAction>() as ILinkedList<IEffectAction>,
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
function consumeTail(depth: number) {
  if (isConsuming || depth !== -1) return;
  isConsuming = true;

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

      const ctx = ErrorScope.begin();
      let node = list.head;
      while (node) {
        const next = node.next;
        try {
          node.value.run();
        } catch (e) {
          ctx.push(e);
        }
        node.removeSelf();
        node = next;
      }
      ErrorScope.end(ctx);
    }
  } finally {
    isConsuming = false;
  }
}
BatchScope.onExited = consumeTail;
