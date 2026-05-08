import { ILinkedList, ILinkedNode, LinkedList } from '../utils';
import { Disposable } from './disposable';
import { scheduler } from './scheduler';
import type { IConnector, ISubscriber } from './types';

/**
 * 负责执行 effect
 */
export class Subscriber extends Disposable implements ISubscriber {
  version: number;
  dependencies: ILinkedList<IConnector>;
  currentConnector: ILinkedNode<IConnector> | null;

  runAction: () => void;

  constructor(runAction: () => void) {
    super();

    this.version = 0;
    this.dependencies = new LinkedList<IConnector>();
    this.currentConnector = null;

    this.runAction = runAction;
  }

  run(): void {
    if (this.isDisposed) return;

    scheduler.run(this, this.runAction);
  }

  dispose(): void {
    if (this.isDisposed) return;

    super.dispose();

    let node = this.dependencies.head;
    while (node) {
      node.value.subscriberNode.removeSelf();
      node.removeSelf();
      node = this.dependencies.head;
    }
    this.dependencies.clear();

    this.version = undefined as unknown as number;
    this.dependencies = undefined as unknown as ILinkedList<IConnector>;
    this.currentConnector = undefined as unknown as ILinkedNode<IConnector>;
    this.runAction = undefined as unknown as () => void;
  }
}
