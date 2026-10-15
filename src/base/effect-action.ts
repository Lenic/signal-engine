import type { ILinkedNode } from '../utils';

import type { IAction, IConnectManager, IEffectAction, INamedObject } from './types';

import { BatchScope } from '../utils';

import { globalContext } from './global-context';
import { Runnable } from './runnable';

export class EffectAction extends Runnable implements IEffectAction, IConnectManager {
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
    if (!globalContext.isRunning && !BatchScope.isBatching) {
      this.run();
    } else {
      if (this.queueNode) return;

      this.queueNode = globalContext.effectList.append(this);
      this.queueNode.onBeforeClear = EffectAction.releaseQueueNode;
    }
  }

  run() {
    this.execute(this._action, undefined, true);
  }

  dispose(): void {
    if (this.isDisposed) return;

    super.dispose();

    this._name = undefined;
    this._action = undefined as unknown as IAction;
  }

  private static releaseQueueNode(node: ILinkedNode<IEffectAction>): void {
    node.value.queueNode = undefined;
  }
}
