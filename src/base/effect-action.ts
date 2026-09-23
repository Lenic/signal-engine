import type { ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IConnectManager, IEffectAction, INamedObject, ISnapshot } from './types';

import { Disposable, ErrorScope, LinkedList } from '../utils';

import { globalContext } from './global-context';

export class EffectAction extends Disposable implements IEffectAction, IConnectManager {
  private _name?: string;
  private _action: IAction;
  private _isSelfRunning: boolean;

  connectors: ILinkedList<ISnapshot>;
  queueNode?: ILinkedNode<IEffectAction>;
  currentConnect?: ILinkedNode<ISnapshot> | null;

  constructor(action: IAction, options?: INamedObject) {
    super();

    this._action = action;
    this._name = options?.name;

    this._isSelfRunning = false;
    this.connectors = new LinkedList<ISnapshot>();
  }

  get name(): string | undefined {
    return this._name;
  }

  markDirty(): void {
    if (!globalContext.isRunning) {
      this.run();
    } else {
      if (this.queueNode) return;

      this.queueNode = globalContext.effectList.append(this);
      this.queueNode.onRemoved = EffectAction.onBeforeQueueNodeRemove;
    }
  }

  /** @internal */
  run() {
    const previousIsRunning = globalContext.isRunning;
    const previousActiveEffect = globalContext.connectManager;

    globalContext.isRunning = true;
    globalContext.connectManager = this;
    try {
      if (this._isSelfRunning) return;
      this._isSelfRunning = true;
      try {
        if (!this.hasDependenciesChanged()) return;

        const ctx = ErrorScope.begin();
        try {
          this.currentConnect = this.connectors.head;
          this._action();
          this.clearConnnectsTail();
        } catch (e) {
          ctx.push(e);
        } finally {
          ErrorScope.end(ctx);
        }
      } finally {
        this._isSelfRunning = false;
      }
    } finally {
      globalContext.isRunning = previousIsRunning;
      globalContext.connectManager = previousActiveEffect;

      globalContext.consumeTail();
    }
  }

  private clearConnnectsTail() {
    let node = this.currentConnect;
    while (node) {
      const next = node.next;
      node.removeSelf();
      node = next;
    }
  }

  private hasDependenciesChanged(): boolean {
    let node = this.connectors.head;
    const ctx = ErrorScope.begin();
    try {
      while (node) {
        try {
          const { value } = node;
          if (value.version !== value.instance.version) return true;
          node = node.next;
        } catch (e) {
          ctx.push(e);
          return false;
        }
      }
    } finally {
      ErrorScope.end(ctx);
    }
    return false;
  }

  private static onBeforeQueueNodeRemove(node: ILinkedNode<IEffectAction>): void {
    node.value.queueNode = void 0;
  }
}
