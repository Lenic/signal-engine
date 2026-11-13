import type { IAction, IDisposable, IEffectAction, ILinked, INamedObject } from './types';

import { BatchScope } from './batch';
import { childrenMethods } from './constants';
import { globalContext } from './context';
import { ErrorScope } from './error';
import { Runnable } from './runnable';

export class EffectAction extends Runnable<EffectAction> implements IEffectAction {
  private _customCleanup?: IAction;
  private _needsToPushToQueue: boolean;
  private _action: IAction<[], void | IAction>;

  isEnqueued: boolean;

  childrenHead?: ILinked<IDisposable>;
  childrenTail?: ILinked<IDisposable>;

  constructor(action: IAction<[], void | IAction>, options?: INamedObject) {
    super(options?.name);

    this.childrenHead = undefined;
    this.childrenTail = undefined;
    this._customCleanup = undefined;

    this._action = action;
    this._needsToPushToQueue = false;

    this.isEnqueued = false;

    this.run();
  }

  adopt(disposable: IDisposable): ILinked<IDisposable> {
    const node: ILinked<IDisposable> = { value: disposable, prev: undefined, next: undefined };
    childrenMethods.append(node, this);
    return node;
  }

  markDirty(): void {
    if (this.isEnqueued) return;

    this.isEnqueued = true;
    globalContext.effectList.push(this);
  }

  run() {
    this.assertNotDisposed();

    if (this._isSelfRunning) {
      this._needsToPushToQueue = true;
      return;
    }

    this.releaseChildren();

    const previousActiveOwner = globalContext.activeOwner;
    globalContext.activeOwner = this;
    try {
      this.execute(EffectAction.runAction, undefined);
    } finally {
      globalContext.activeOwner = previousActiveOwner;

      if (this._needsToPushToQueue) {
        this._needsToPushToQueue = false;

        // fire consumeTail method of the global-context file.
        if (BatchScope.isBatching) {
          this.markDirty();
        } else {
          const level = BatchScope.begin();
          try {
            this.markDirty();
          } finally {
            BatchScope.end(level);
          }
        }
      }
    }
  }

  disposeWithErrorContext(): void {
    super.disposeWithErrorContext();

    this.isEnqueued = false;
    this._action = undefined as unknown as IAction;

    try {
      this.runCustomCleanup();
    } catch (e) {
      ErrorScope.record(e);
    }

    try {
      this.releaseChildren();
    } catch (e) {
      ErrorScope.record(e);
    }
  }

  private releaseChildren() {
    let node = this.childrenHead;
    if (!node) return;

    const batchLevel = BatchScope.isBatching ? null : BatchScope.begin();
    const errorLevel = ErrorScope.isActive ? null : ErrorScope.begin();

    try {
      while (node) {
        try {
          childrenMethods.remove(node, this);
          node.value.dispose();
        } catch (e) {
          ErrorScope.record(e);
        }
        node = this.childrenHead;
      }
    } finally {
      try {
        if (errorLevel !== null) ErrorScope.end(errorLevel);
      } finally {
        if (batchLevel !== null) BatchScope.end(batchLevel);
      }
    }
  }

  private runCustomCleanup() {
    if (!this._customCleanup) return;

    try {
      globalContext.untracked(this._customCleanup);
    } finally {
      this._customCleanup = undefined;
    }
  }

  private static runAction(ctx: EffectAction) {
    ctx.runCustomCleanup();

    if (ctx.isDisposed) return;

    const result = ctx._action();
    if (typeof result === 'function') {
      ctx._customCleanup = result;
    }
  }
}
