import type {
  IAction,
  IConnector,
  IDisposable,
  IEffectAction,
  ILinked,
  INamedObject,
  TDirtyType,
  TMarkableDirtyType,
} from './types';

import { BatchScope } from './batch';
import { childrenMethods } from './constants';
import { globalContext } from './context';
import { ErrorScope } from './error';
import { Runnable } from './runnable';
import { DIRTY_TYPE_CLEAN } from './types';

export class EffectAction extends Runnable<EffectAction> implements IEffectAction {
  private _customCleanup?: IAction;
  private _needsToPushToQueue: TDirtyType;
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
    this._needsToPushToQueue = DIRTY_TYPE_CLEAN;

    this.isEnqueued = false;

    this.run();
  }

  adopt(disposable: IDisposable): ILinked<IDisposable> {
    const tail = this.childrenTail;
    const node: ILinked<IDisposable> = {
      value: disposable,
      prev: tail,
      next: undefined,
    };

    if (tail) {
      tail.next = node;
    } else {
      this.childrenHead = node;
    }
    this.childrenTail = node;

    return node;
  }

  markDirty(dirtyType: TMarkableDirtyType): IConnector | undefined {
    if (this.isDisposed) return;

    this.dirtyType = dirtyType;

    if (!this.isEnqueued) {
      this.isEnqueued = true;
      globalContext.effectList.push(this);
    }
  }

  run() {
    if (!this.shoudRun()) return;

    if (this.isSelfRunning) {
      this._needsToPushToQueue = this.dirtyType;
      return;
    }
    this._needsToPushToQueue = DIRTY_TYPE_CLEAN;

    this.releaseChildren();

    const previousActiveOwner = globalContext.activeOwner;
    globalContext.activeOwner = this;
    try {
      this.execute(EffectAction.runAction);
    } finally {
      globalContext.activeOwner = previousActiveOwner;

      if (this._needsToPushToQueue !== DIRTY_TYPE_CLEAN) {
        const arg = this._needsToPushToQueue;
        this._needsToPushToQueue = DIRTY_TYPE_CLEAN;

        if (BatchScope.isBatching) {
          this.markDirty(arg);
        } else {
          const level = BatchScope.begin();
          this.markDirty(arg);
          BatchScope.end(level);
        }
      }
    }
  }

  disposeWithErrorContext(): void {
    super.disposeWithErrorContext();

    this.isEnqueued = false;
    this._action = undefined as unknown as IAction;

    this.releaseChildren();
  }

  private releaseChildren() {
    if (!this.childrenHead && !this._customCleanup) return;

    const errorLevel = ErrorScope.isActive ? undefined : ErrorScope.begin();
    for (let node = this.childrenHead; node; node = this.childrenHead) {
      try {
        childrenMethods.remove(node, this);
        node.value.dispose();
      } catch (e) {
        ErrorScope.record(e);
      }
    }

    if (this._customCleanup) {
      try {
        globalContext.untracked(this._customCleanup);
      } catch (e) {
        ErrorScope.record(e);
      } finally {
        this._customCleanup = undefined;
      }
    }
    if (errorLevel !== undefined) ErrorScope.end(errorLevel);
  }

  private static runAction(ctx: EffectAction) {
    if (ctx.isDisposed) return;

    const result = ctx._action();
    if (typeof result === 'function') {
      ctx._customCleanup = result;
    }
  }
}
