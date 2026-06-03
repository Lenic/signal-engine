import { Disposable, ILinkedList, ILinkedNode, IQueueable, LinkedList, Queueable } from '../utils';
import { scheduler } from './scheduler';
import { ESignalType, IConnector, ISignalOptions, ISubscriber } from './types';
import { getUniqueId } from './utils';

export class Subscriber extends Disposable implements ISubscriber {
  private isInitial: boolean;
  private isExecuting: boolean;
  private runAction: () => void;
  private queue: IQueueable<ISubscriber>;

  id: number;
  name?: string;
  version: number;
  type: ESignalType;
  children: ILinkedList<ISubscriber> | null;
  dependencies: ILinkedList<IConnector>;
  currentConnector: ILinkedNode<IConnector> | null;

  constructor(runAction: () => void, options?: ISignalOptions) {
    super();

    this.version = 0;
    this.children = null;
    this.isInitial = true;
    this.isExecuting = false;
    this.currentConnector = null;

    this.name = options?.name;
    this.runAction = runAction;
    this.type = options?.type ?? ESignalType.EFFECT;

    this.id = getUniqueId();
    this.dependencies = new LinkedList<IConnector>();
    this.queue = new Queueable<ISubscriber>(scheduler.dirtySubscribers);

    const parent = scheduler.activeSubscriber;
    if (parent) {
      if (!parent.children) {
        parent.children = new LinkedList<ISubscriber>();
      }
      const nodeInParent = parent.children.add(this);
      this.disposeWithMe(() => nodeInParent.removeSelf());
    }
  }

  run(customAction?: () => void): void {
    this.checkDisposed();

    if (!this.isChanged()) return;

    const prev = scheduler.activeSubscriber;
    scheduler.activeSubscriber = this;

    try {
      this.version = 0;
      this.isExecuting = true;

      this.currentConnector = this.dependencies.head;

      this.disposeChildren();
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

  setConnectorNode(connectorNode: ILinkedNode<IConnector> | null): void {
    this.currentConnector = connectorNode;
    this.version += 1;
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

    this.queue.dispose();
    this.disposeChildren();

    this.version = undefined as unknown as number;
    this.runAction = undefined as unknown as () => void;
    this.children = undefined as unknown as ILinkedList<ISubscriber>;
    this.dependencies = undefined as unknown as ILinkedList<IConnector>;
    this.currentConnector = undefined as unknown as ILinkedNode<IConnector>;
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

  private isChanged() {
    if (this.isInitial) {
      this.isInitial = false;
      return true;
    }

    let node = this.dependencies.head;
    while (node) {
      const { value } = node;
      if (value.lastObservableVersion !== value.observable.version) return true;
      node = node.next;
    }
    return false;
  }
}
