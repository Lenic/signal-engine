import { Disposable, ILinkedList, ILinkedNode, IQueueable, LinkedList, Queueable } from '../utils';
import { scheduler } from './scheduler';
import { ESignalType, IConnector, ISubscriber } from './types';
import { getUniqueId } from './utils';

export class Subscriber extends Disposable implements ISubscriber {
  private isExecuting: boolean;
  private queue: IQueueable<ISubscriber>;
  private name: string | undefined;

  version: number;
  children: ILinkedList<ISubscriber> | null;
  dependencies: ILinkedList<IConnector>;
  currentConnector: ILinkedNode<IConnector> | null;

  type: ESignalType;
  currentId: number;
  runAction: () => void;

  constructor(runAction: () => void, type: ESignalType = ESignalType.EFFECT, name?: string) {
    super();

    this.name = name;

    this.type = type;
    this.isExecuting = false;
    this.currentId = getUniqueId();
    this.queue = new Queueable<ISubscriber>(scheduler.dirtySubscribers);

    this.version = 0;
    this.children = null;
    this.dependencies = new LinkedList<IConnector>();
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

  run(customAction?: () => void): void {
    this.checkDisposed();

    const prev = scheduler.activeSubscriber;
    scheduler.activeSubscriber = this;

    try {
      this.isExecuting = true;

      this.currentConnector = this.dependencies.head;

      this.disposeChildren();
      this.version += 1;
      if (customAction) {
        customAction();
      } else {
        this.runAction();
      }

      let staleNode = this.currentConnector;
      while (staleNode) {
        staleNode.value.subscriberNode.removeSelf();
        const nextNode = staleNode.next;
        staleNode.removeSelf();
        staleNode = nextNode;
      }
      this.currentConnector = null;
    } finally {
      this.isExecuting = false;

      this.queue.removeFromQueue();
      scheduler.activeSubscriber = prev;
    }
  }

  scheduleUpdate(): void {
    if (this.isExecuting) {
      throw new Error('[Subscriber]: Infinite loop detected!!!');
    }
    if (this.queue.isInQueue || this.isDisposed) return;

    this.queue.addToQueue(this);
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
    this.queue.dispose();

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
