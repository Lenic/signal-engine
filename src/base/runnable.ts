import type {
  IAction,
  IConnector,
  IDisposable,
  IEffectOwner,
  ILinked,
  IRunnable,
  TDirtyType,
  TMarkableDirtyType,
} from './types';

import { childrenMethods } from './constants';
import { globalContext } from './context';
import { Disposable } from './disposable';
import { DIRTY_TYPE_CLEAN, DIRTY_TYPE_DIRTY, DIRTY_TYPE_UNCHECKED } from './types';

export abstract class Runnable<T extends Runnable<T>> extends Disposable implements IRunnable {
  private _owner?: IEffectOwner;
  private _ownNode?: ILinked<IDisposable>;

  protected isSelfRunning: boolean;

  name?: string;
  runId: number;

  dirtyType: TDirtyType;

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

    this.isSelfRunning = false;
    this.dirtyType = DIRTY_TYPE_DIRTY;

    this._owner = globalContext.activeOwner;
    this._ownNode = globalContext.activeOwner?.adopt(this);
  }

  abstract markDirty(dirtyType: TMarkableDirtyType): IConnector | undefined;

  disposeWithErrorContext(): void {
    this.isSelfRunning = false;
    this.dirtyType = DIRTY_TYPE_CLEAN;

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

  protected shoudRun(): boolean {
    if (this.dirtyType === DIRTY_TYPE_CLEAN || this.isDisposed) return false;

    const originalDirtyType = this.dirtyType;
    this.dirtyType = DIRTY_TYPE_CLEAN;
    if (originalDirtyType === DIRTY_TYPE_UNCHECKED && (this.isUpToDate() || this.isDisposed)) return false;

    return true;
  }

  protected execute<TResult = void>(action: IAction<[context: T], TResult>): TResult {
    if (this.isSelfRunning) {
      throw new Error('[Runnable]: Cannot run iteratively.');
    }

    this.isSelfRunning = true;

    const previousActiveEffect = globalContext.activeEffect;
    globalContext.activeEffect = this;

    try {
      return this.runAction(action);
    } finally {
      this.isSelfRunning = false;

      globalContext.activeEffect = previousActiveEffect;
    }
  }

  private isUpToDate(): boolean {
    let node = this.connectibleHead;
    while (node) {
      if (node.connectibleVersion !== node.connectible.version) return false;
      node = node.nextConnectible;
    }

    return true;
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
