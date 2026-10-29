import type { IDisposable, ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IEffectAction, INamedObject } from './types';

import { LinkedList } from '../utils';

import { BatchScope } from './batch';
import { globalContext } from './context';
import { Runnable } from './runnable';
import { notifyListeners } from './utils';

export class EffectAction extends Runnable<EffectAction> implements IEffectAction {
  private _name?: string;
  private _customCleanup?: IAction;
  private _needsToPushToQueue: boolean;
  private _action: IAction<[], void | IAction>;
  private _children?: ILinkedList<IDisposable>;
  private _queueNode?: ILinkedNode<IEffectAction>;

  constructor(action: IAction<[], void | IAction>, options?: INamedObject) {
    super();

    this._children = undefined;
    this._queueNode = undefined;
    this._customCleanup = undefined;

    this._action = action;
    this._name = options?.name;
    this._needsToPushToQueue = false;

    this.run();
  }

  get name(): string | undefined {
    return this._name;
  }

  adopt(disposable: IDisposable): ILinkedNode<IDisposable> {
    return (this._children ??= new LinkedList<IDisposable>()).append(disposable);
  }

  markDirty(): void {
    if (!globalContext.isEffectRunning && !BatchScope.isBatching) {
      this.run();
    } else {
      this.pushToQueue();
    }
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
        const level = BatchScope.begin();
        try {
          this.pushToQueue();
        } finally {
          BatchScope.end(level);
        }
      }
    }
  }

  dispose(): void {
    if (this.isDisposed) return;

    super.dispose();

    this._name = undefined;
    this._action = undefined as unknown as IAction;

    this._queueNode?.removeSelf();
    this._queueNode = undefined;

    this.releaseChildren();
    this._children = undefined;

    this.runCustomCleanup();
  }

  private pushToQueue() {
    if (this._queueNode) return;

    this._queueNode = globalContext.effectList.append(this);
    this._queueNode.onBeforeClear = EffectAction.releaseQueueNode;
  }

  private releaseChildren() {
    notifyListeners(this._children, EffectAction.releaseItem, true);
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

  private static releaseQueueNode(node: ILinkedNode<IEffectAction>): void {
    (node.value as EffectAction)._queueNode = undefined;
  }

  private static releaseItem(disposable: IDisposable): void {
    disposable.dispose();
  }
}
