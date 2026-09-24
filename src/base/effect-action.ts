import type { IDisposable, ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IConnectManager, IEffectAction, INamedObject, ISnapshot } from './types';

import { Disposable, ErrorScope, LinkedList } from '../utils';

import { globalContext } from './global-context';

export class EffectAction extends Disposable implements IEffectAction, IConnectManager {
  private _name?: string;
  private _action: IAction;
  private _isSelfRunning: boolean;
  private _isInitialized: boolean;
  private _children?: ILinkedList<IDisposable>;

  connectors: ILinkedList<ISnapshot>;
  queueNode?: ILinkedNode<IEffectAction>;
  currentConnect?: ILinkedNode<ISnapshot> | null;

  constructor(action: IAction, options?: INamedObject) {
    super();

    this._action = action;
    this._name = options?.name;

    this._isInitialized = false;
    this._isSelfRunning = false;
    this.connectors = new LinkedList<ISnapshot>();

    this.run();
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
      this.queueNode.onBeforeClear = EffectAction.releaseQueueNode;
    }
  }

  run() {
    const previousIsRunning = globalContext.isRunning;
    const previousActiveEffect = globalContext.activeEffect;

    globalContext.isRunning = true;
    globalContext.activeEffect = this;
    try {
      if (this._isSelfRunning) return;
      this._isSelfRunning = true;
      try {
        if (!this.hasDependenciesChanged()) return;

        const ctx = ErrorScope.begin();
        try {
          this.releaseChildren();
          previousActiveEffect?.adopt(this);

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
      globalContext.activeEffect = previousActiveEffect;

      globalContext.consumeTail();
    }
  }

  adopt(disposable: IDisposable): ILinkedNode<IDisposable> {
    if (!this._children) {
      this._children = new LinkedList<IDisposable>();
    }
    return this._children.append(disposable);
  }

  dispose(): void {
    if (this.isDisposed) return;

    super.dispose();

    this._name = undefined;
    this._isInitialized = false;
    this._isSelfRunning = false;
    this._action = undefined as unknown as IAction;

    this.queueNode?.removeSelf();

    this.releaseChildren();

    this.currentConnect = null;
    let node = this.connectors.head;
    while (node) {
      node.value.node.removeSelf();
      node.removeSelf();
      node = this.connectors.head;
    }
    this.connectors = undefined as unknown as ILinkedList<ISnapshot>;
  }

  private releaseChildren() {
    let node = this._children?.head;
    while (node) {
      node.value?.dispose();
      node.removeSelf();
      node = this._children?.head;
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
    if (!this._isInitialized) {
      this._isInitialized = true;
      return true;
    }

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

  private static releaseQueueNode(node: ILinkedNode<IEffectAction>): void {
    node.value.queueNode = undefined;
  }
}
