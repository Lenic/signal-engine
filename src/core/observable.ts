import { ILinkedList, LinkedList } from '../utils';
import { IConnector, IObservable, ISubscriber } from './types';
import { scheduler } from './scheduler';

export class Observable implements IObservable {
  subscribers: ILinkedList<ISubscriber>;

  constructor() {
    this.subscribers = new LinkedList<ISubscriber>();
  }

  track(): void {
    const subscriber = scheduler.activeSubscriber;
    if (!subscriber) return;

    const node = subscriber.currentConnector;

    // 1. If the current connector already matches the observable, just update the version
    if (node && node.value.observable === this) {
      node.value.lastVersion = subscriber.version;
      subscriber.currentConnector = node.next;
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
      lastVersion: subscriber.version,
    };

    // 4. Update the list and move the pointer forward
    if (node) {
      node.value = connector;
      subscriber.currentConnector = node.next;
    } else {
      subscriber.currentConnector = subscriber.dependencies.add(connector).next;
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
}
