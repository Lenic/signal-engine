import { ILinkedList, ILinkedNode, LinkedList } from '../utils';
import { Disposable } from './disposable';
import { scheduler } from './scheduler';
import type { IConnector, ISubscriber } from './types';

/**
 * 负责执行 effect
 */
export class Subscriber extends Disposable implements ISubscriber {
  version: number;
  children: ILinkedList<ISubscriber> | null;
  dependencies: ILinkedList<IConnector>;
  scheduledNode: ILinkedNode<ISubscriber> | null;
  currentConnector: ILinkedNode<IConnector> | null;

  runAction: () => void;

  constructor(runAction: () => void) {
    super();

    this.version = 0;
    this.children = null;
    this.dependencies = new LinkedList<IConnector>();
    this.scheduledNode = null;
    this.currentConnector = null;

    this.runAction = runAction;

    const parent = scheduler.activeSubscriber;
    if (parent) {
      if (!parent.children) {
        parent.children = new LinkedList<ISubscriber>();
      }
      parent.children.add(this);
    }
  }

  run(): void {
    this.checkDisposed();

    const prev = scheduler.activeSubscriber;
    scheduler.activeSubscriber = this;

    try {
      // Reset the tracking pointer to the start of the dependency list
      this.currentConnector = this.dependencies.head;

      this.disposeChildren();
      this.version += 1;
      this.runAction();

      // Cleanup phase: remove any connectors that were not visited during the run
      let staleNode = this.currentConnector;
      while (staleNode) {
        // Remove the subscription from the observable's list
        staleNode.value.subscriberNode.removeSelf();
        // Remove the connector from the subscriber's dependency list
        this.dependencies.remove(staleNode);
        staleNode = staleNode.next;
      }
      this.currentConnector = null;
    } finally {
      this.scheduledNode = null;
      scheduler.activeSubscriber = prev;
    }
  }

  scheduleUpdate(): void {
    if (this.scheduledNode || this.isDisposed) return;

    this.scheduledNode = scheduler.dirtySubscribers.add(this);
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

    this.disposeChildren();
    this.scheduledNode?.removeSelf();

    this.version = undefined as unknown as number;
    this.children = undefined as unknown as ILinkedList<ISubscriber>;
    this.dependencies = undefined as unknown as ILinkedList<IConnector>;
    this.currentConnector = undefined as unknown as ILinkedNode<IConnector>;
    this.runAction = undefined as unknown as () => void;
  }

  private disposeChildren(): void {
    if (this.children) {
      let child = this.children.head;
      while (child) {
        child.value.dispose();
        child.removeSelf();
        child = this.children.head;
      }
    }
  }
}
