import type { IDisposable, ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IConnectManager, IDirtyMarkable, IEffectAction, ISnapshot } from './types';

import { Disposable, ErrorScope, LinkedList } from '../utils';

import { globalContext } from './global-context';

export abstract class Runnable<T extends Runnable<T>> extends Disposable implements IDirtyMarkable, IConnectManager {
  private _isSelfRunning: boolean;
  private _isInitialized: boolean;
  private _ownNode?: ILinkedNode<IDisposable>;

  connectors: ILinkedList<ISnapshot>;
  queueNode?: ILinkedNode<IEffectAction>;
  currentConnect?: ILinkedNode<ISnapshot> | null;

  constructor() {
    super();

    this._isInitialized = false;
    this._isSelfRunning = false;
    this.connectors = new LinkedList<ISnapshot>();
    this._ownNode = globalContext.activeOwner?.adopt(this);
  }

  abstract markDirty(): void;

  protected execute<TResult = void, TDefaultValue = void>(
    action: IAction<[context: T], TResult>,
    defalutValue: TDefaultValue,
  ): TResult | TDefaultValue {
    this.assertNotDisposed();

    if (this._isSelfRunning) {
      throw new Error('[Runnable]: Cannot run iteratively.');
    }
    this._isSelfRunning = true;

    const previousActiveEffect = globalContext.activeEffect;
    const previousIsEffectRunning = globalContext.isEffectRunning;
    globalContext.activeEffect = this;
    globalContext.isEffectRunning = true;

    try {
      if (!this.hasDependenciesChanged()) return defalutValue;

      const ctx = ErrorScope.begin();
      try {
        this.currentConnect = this.connectors.head;
        const result = action(this as unknown as T);
        this.clearConnnectsTail();
        return result;
      } catch (e) {
        ctx.push(e);
        return defalutValue;
      } finally {
        ErrorScope.end(ctx);
      }
    } finally {
      this._isSelfRunning = false;

      globalContext.activeEffect = previousActiveEffect;
      globalContext.isEffectRunning = previousIsEffectRunning;
    }
  }

  dispose(): void {
    if (this.isDisposed) return;

    super.dispose();

    this._isInitialized = false;
    this._isSelfRunning = false;

    this.queueNode?.removeSelf();
    this.queueNode = undefined;

    this._ownNode?.removeSelf();
    this._ownNode = undefined;

    this.currentConnect = null;
    let node = this.connectors.head;
    while (node) {
      node.value.node.removeSelf();
      node.removeSelf();
      node = this.connectors.head;
    }
    this.connectors = undefined as unknown as ILinkedList<ISnapshot>;
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
}
