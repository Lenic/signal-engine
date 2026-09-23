import type { ILinkedList } from '../utils';

import type { IConnectManager, IEffectAction, IVersioned } from './types';

import { ErrorScope, LinkedList } from '../utils';

const MAX_ITERATION_DEPTH = 100;

export const globalContext = {
  isRunning: false,
  isConsuming: false,
  effectList: new LinkedList<IEffectAction>() as ILinkedList<IEffectAction>,
  connectManager: undefined as IConnectManager | undefined,
  track(source: IVersioned): void {
    if (!this.connectManager) return;

    const ctx = ErrorScope.begin();
    try {
      const manager = this.connectManager;
      const sourceVersion = source.version;
      if (!manager.currentConnect) {
        const node = manager.connectors.append({
          instance: source,
          version: sourceVersion,
        });
        this.connectManager.currentConnect = node.next;
      } else {
        const { value } = manager.currentConnect;
        if (source === value.instance) {
          value.version = sourceVersion;
        } else {
          manager.currentConnect.value = {
            instance: source,
            version: sourceVersion,
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
