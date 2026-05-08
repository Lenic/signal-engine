import { ILinkedList, LinkedList } from '../utils';
import { IObservable, ISubscriber } from './types';
import { scheduler } from './scheduler';

export class Observable implements IObservable {
  subscribers: ILinkedList<ISubscriber>;

  constructor() {
    this.subscribers = new LinkedList<ISubscriber>();
  }

  track(): void {
    scheduler.track(this);
  }

  trigger(): void {
    let current = this.subscribers.head;
    while (current) {
      current.value.run();
      current = current.next;
    }
  }
}
