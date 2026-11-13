import type { IAction, IConnector, IDisposable, IEffectOwner, ILinked, IRunnable } from './types';

import { childrenMethods } from './constants';
import { globalContext } from './context';
import { Disposable } from './disposable';

export abstract class Runnable<T extends Runnable<T>> extends Disposable implements IRunnable {
  private _isInitialized: boolean;

  private _owner?: IEffectOwner;
  private _ownNode?: ILinked<IDisposable>;

  protected isSelfRunning: boolean;

  name?: string;
  runId: number;

  connectibleHead?: IConnector;
  connectibleTail?: IConnector;

  connectibleCurrent?: IConnector;

  constructor(name?: string) {
    super();

    this.connectibleHead = undefined;
    this.connectibleTail = undefined;
    this.connectibleCurrent = undefined;

    this.runId = 0;
    this.name = name;

    this._isInitialized = false;
    this.isSelfRunning = false;

    this._owner = globalContext.activeOwner;
    this._ownNode = globalContext.activeOwner?.adopt(this);
  }

  abstract markDirty(): IConnector | undefined;

  disposeWithErrorContext(): void {
    this._isInitialized = false;
    this.isSelfRunning = false;

    if (this._ownNode && this._owner) {
      childrenMethods.remove(this._ownNode, this._owner);

      this._owner = undefined;
      this._ownNode = undefined;
    }

    let node = this.connectibleHead;
    while (node) {
      node.dispose();
      node = this.connectibleHead;
    }
  }

  protected isUpToDate(): boolean {
    if (!this._isInitialized) return false;

    let node = this.connectibleHead;
    while (node) {
      if (node.connectibleVersion !== node.connectible.version) return false;
      node = node.nextConnectible;
    }

    return true;
  }

  protected execute<TResult = void>(action: IAction<[context: T], TResult>): TResult {
    this.assertNotDisposed();

    if (this.isSelfRunning) {
      throw new Error('[Runnable]: Cannot run iteratively.');
    }

    this.isSelfRunning = true;
    this._isInitialized = true;

    const previousActiveEffect = globalContext.activeEffect;
    const previousIsEffectRunning = globalContext.isEffectRunning;
    globalContext.activeEffect = this;
    globalContext.isEffectRunning = true;

    try {
      return this.runAction(action);
    } finally {
      this.isSelfRunning = false;

      globalContext.activeEffect = previousActiveEffect;
      globalContext.isEffectRunning = previousIsEffectRunning;
    }
  }

  private runAction<TResult = void>(action: IAction<[context: T], TResult>): TResult {
    this.runId += 1;
    this.connectibleCurrent = this.connectibleHead;
    const result = action(this as unknown as T);
    this.clearConnnectsTail();
    return result;
  }

  private clearConnnectsTail() {
    let node = this.connectibleCurrent;
    while (node) {
      const next = node.nextConnectible;
      node.dispose();
      node = next;
    }
  }
}
