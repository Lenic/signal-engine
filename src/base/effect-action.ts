import type { ILinkedNode } from '../utils';

import type { IAction, IConnectManager, IDirtyMarkable, IEffectAction, INamedObject } from './types';

import { BatchScope } from '../utils';

import { globalContext } from './global-context';
import { Runnable } from './runnable';

export class EffectAction extends Runnable<EffectAction> implements IEffectAction, IConnectManager {
  private _name?: string;
  private _action: IAction;

  constructor(action: IAction, options?: INamedObject) {
    super();

    this._action = action;
    this._name = options?.name;

    this.run();
  }

  get name(): string | undefined {
    return this._name;
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

    this.execute(EffectAction.runAction, undefined);
  }

  dispose(): void {
    if (this.isDisposed) return;

    super.dispose();

    this._name = undefined;
    this._action = undefined as unknown as IAction;
  }

  private static runAction(ctx: EffectAction, previousActiveEffect?: IDirtyMarkable & IConnectManager) {
    previousActiveEffect?.adopt(ctx);

    ctx.execute(ctx._action, undefined);
  }

  private static releaseQueueNode(node: ILinkedNode<IEffectAction>): void {
    node.value.queueNode = undefined;
  }
}
