import { IConnector, IObservable, ISubscriber, IScheduler } from './types';

export const scheduler: IScheduler = {
  activeSubscriber: null,

  run<T>(subscriber: ISubscriber, action: () => T): T {
    const prev = this.activeSubscriber;
    this.activeSubscriber = subscriber;

    // Reset the tracking pointer to the start of the dependency list
    subscriber.currentConnector = subscriber.dependencies.head;

    try {
      subscriber.version += 1;
      const result = action();

      // Cleanup phase: remove any connectors that were not visited during the run
      let staleNode = subscriber.currentConnector;
      while (staleNode) {
        // Remove the subscription from the observable's list
        staleNode.value.subscriberNode.removeSelf();
        // Remove the connector from the subscriber's dependency list
        subscriber.dependencies.remove(staleNode);
        staleNode = staleNode.next;
      }
      subscriber.currentConnector = null;

      return result;
    } finally {
      this.activeSubscriber = prev;
    }
  },

  track(observable: IObservable) {
    const subscriber = this.activeSubscriber;
    if (!subscriber) return;

    const node = subscriber.currentConnector;

    // 1. If the current connector already matches the observable, just update the version
    if (node && node.value.observable === observable) {
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
    const subscriberNode = observable.subscribers.add(subscriber);
    const connector: IConnector = {
      lastVersion: subscriber.version,
      observable,
      subscriberNode,
    };

    // 4. Update the list and move the pointer forward
    if (node) {
      node.value = connector;
      subscriber.currentConnector = node.next;
    } else {
      subscriber.currentConnector = subscriber.dependencies.add(connector).next;
    }
  },
};
