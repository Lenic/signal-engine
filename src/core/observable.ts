import { ILinkedList, LinkedList, Queueable, IQueueable } from '../utils';
import { ESignalType, IConnector, IObservable, IPendingObservable, IObservableOptions, ISubscriber } from './types';
import { scheduler } from './scheduler';
import { getUniqueId } from './utils';

export class Observable implements IObservable {
  private refreshVersionAction?: () => void;

  id: number;
  name?: string;
  version: number;
  type: ESignalType;
  queue: IQueueable<IPendingObservable>;
  subscribers: ILinkedList<ISubscriber>;

  constructor(options?: IObservableOptions) {
    this.version = 0;

    this.name = options?.name;
    this.type = options?.type ?? ESignalType.SIGNAL;
    this.refreshVersionAction = options?.refreshVersionAction;

    this.id = getUniqueId();
    this.subscribers = new LinkedList<ISubscriber>();
    this.queue = new Queueable<IPendingObservable>(scheduler.dirtyObservables);
  }

  track(): void {
    const subscriber = scheduler.activeSubscriber;
    if (!subscriber) return;

    const node = subscriber.currentConnector;

    // 1. If the current connector already matches the observable, just update the version
    if (node && node.value.observable === this) {
      node.value.lastObservableVersion = this.version;
      node.value.lastRunVersion = subscriber.version;
      subscriber.setConnectorNode(node.next);
      return;
    }

    // 2. Dependency changed or a new dependency encountered
    if (node) {
      // Remove old subscription since we are replacing this slot
      node.value.subscriberNode.removeSelf();
    }

    // 3. Create a new subscription and connector data
    const subscriberNode = this.subscribers.add(subscriber);
    const connector: IConnector = {
      subscriberNode,
      observable: this,
      lastRunVersion: subscriber.version,
      lastObservableVersion: this.version,
    };

    // 4. Update the list and move the pointer forward
    if (node) {
      node.value = connector;
      subscriber.setConnectorNode(node.next);
    } else {
      subscriber.setConnectorNode(subscriber.dependencies.add(connector).next);
    }
  }

  trigger(): void {
    scheduler.batch(() => {
      let current = this.subscribers.head;
      while (current) {
        current.value.scheduleUpdate();
        current = current.next;
      }
    });
  }

  getVersion(): number {
    this.refreshVersionAction?.();

    return this.version;
  }

  upgradeVersion(): void {
    this.version += 1;
  }
}
