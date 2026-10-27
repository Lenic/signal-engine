import type { IDisposable, ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IConnectManager, IEffectAction, INamedObject } from './types';

import { BatchScope, LinkedList } from '../utils';

import { globalContext } from './global-context';
import { Runnable } from './runnable';
import { notifyListeners } from './utils';

export class EffectAction extends Runnable<EffectAction> implements IEffectAction, IConnectManager {
  private _name?: string;
  private _action: IAction;
  private _children?: ILinkedList<IDisposable>;

  constructor(action: IAction, options?: INamedObject) {
    super();

    this._action = action;
    this._name = options?.name;

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
      if (this.queueNode) return;

      this.queueNode = globalContext.effectList.append(this);
      this.queueNode.onBeforeClear = EffectAction.releaseQueueNode;
    }
  }

  run() {
    this.assertNotDisposed();

    this.releaseChildren();

    const previousActiveOwner = globalContext.activeOwner;
    globalContext.activeOwner = this;
    try {
      this.execute(EffectAction.runAction, undefined);
    } finally {
      globalContext.activeOwner = previousActiveOwner;
    }
  }

  dispose(): void {
    if (this.isDisposed) return;

    super.dispose();

    this._name = undefined;
    this._action = undefined as unknown as IAction;

    this.releaseChildren();
    this._children = undefined;
  }

  private releaseChildren() {
    notifyListeners(this._children, EffectAction.releaseItem, true);
  }

  private static runAction(ctx: EffectAction) {
    ctx._action();
  }

  private static releaseQueueNode(node: ILinkedNode<IEffectAction>): void {
    (node.value as EffectAction).queueNode = undefined;
  }

  private static releaseItem(disposable: IDisposable): void {
    disposable.dispose();
  }
}
