import type { IAction, IConnector, IDisposable, IEffectOwner, ILinked, IRunnable } from './types';

import { childrenMethods } from './constants';
import { globalContext } from './context';
import { Disposable } from './disposable';

export abstract class Runnable<T extends Runnable<T>> extends Disposable implements IRunnable {
  private _name?: string;
  private _runId: number;
  private _isInitialized: boolean;

  private _ownNode?: ILinked<IDisposable>;
  private _owner?: IEffectOwner;

  protected _isSelfRunning: boolean;

  connectibleHead?: IConnector;
  connectibleTail?: IConnector;

  connectibleCurrent?: IConnector;

  constructor(name?: string) {
    super();

    this.connectibleHead = undefined;
    this.connectibleTail = undefined;
    this.connectibleCurrent = undefined;

    this._runId = 0;
    this._name = name;
    this._isInitialized = false;
    this._isSelfRunning = false;

    this._owner = globalContext.activeOwner;
    this._ownNode = globalContext.activeOwner?.adopt(this);
  }

  abstract markDirty(): IConnector | undefined;

  get name(): string | undefined {
    return this._name;
  }

  get runId(): number {
    return this._runId;
  }

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

      if (this.isDisposed) return defalutValue;

      return this.runAction(action);
    } finally {
      this._isSelfRunning = false;

      globalContext.activeEffect = previousActiveEffect;
      globalContext.isEffectRunning = previousIsEffectRunning;
    }
  }

  disposeWithErrorContext(): void {
    this._isInitialized = false;
    this._isSelfRunning = false;

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

  private runAction<TResult>(action: IAction<[context: T], TResult>): TResult {
    this._runId += 1;
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

  private hasDependenciesChanged(): boolean {
    if (!this._isInitialized) {
      this._isInitialized = true;
      return true;
    }

    let node = this.connectibleHead;
    while (node) {
      if (node.connectibleVersion !== node.connectible.version) return true;
      node = node.nextConnectible;
    }

    return false;
  }
}
