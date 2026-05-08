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
    scheduler.run(this, this.runAction);
  }
}
