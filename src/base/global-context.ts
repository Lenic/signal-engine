import type { ILinkedList } from '../utils';

import type { IChangeListenerSource, IConnectManager, IDirtyMarkable, IEffectAction, IVersioned } from './types';

import { ErrorScope, LinkedList } from '../utils';

const MAX_ITERATION_DEPTH = 100;

export const globalContext = {
  isRunning: false,
  isConsuming: false,
  effectList: new LinkedList<IEffectAction>() as ILinkedList<IEffectAction>,
  connectManager: undefined as (IConnectManager & IDirtyMarkable) | undefined,
  track(source: IVersioned & IChangeListenerSource<IDirtyMarkable>): void {
    if (!this.connectManager) return;

    const ctx = ErrorScope.begin();
    try {
      const manager = this.connectManager;
      const sourceVersion = source.version;
      if (!manager.currentConnect) {
        const connector = manager.connectors.append({
          instance: source,
          version: sourceVersion,
          node: source.addChangeListener(manager),
        });
        this.connectManager.currentConnect = connector.next;
      } else {
        const { value } = manager.currentConnect;
        if (source === value.instance) {
          value.version = sourceVersion;
        } else {
          manager.currentConnect.value.node.removeSelf();
          manager.currentConnect.value = {
            instance: source,
            version: sourceVersion,
            node: source.addChangeListener(manager),
          };
        }
        manager.currentConnect = manager.currentConnect.next;
      }
    } catch (e) {
      ctx.push(e);
    } finally {
      ErrorScope.end(ctx);
    }
  },
  consumeTail() {
    if (this.isConsuming) return;
    this.isConsuming = true;

    let depth = 0;
    while (this.effectList.size) {
      if (depth > MAX_ITERATION_DEPTH) {
        throw new Error('[ConsumeTail]: more than the max iteration.');
      }
      depth += 1;

      const ctx = ErrorScope.begin();
      let node = this.effectList.head;
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
      this.isConsuming = false;
      ErrorScope.end(ctx);
    }
  },
};
