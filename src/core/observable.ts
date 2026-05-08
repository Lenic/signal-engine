import { ILinkedList, LinkedList } from '../utils';
import { Disposable } from './disposable';
import { IObservable, ISubscriber } from './types';
import { scheduler } from './scheduler';

export class Observable extends Disposable implements IObservable {
  subscribers: ILinkedList<ISubscriber>;

  constructor() {
    super();

    this.subscribers = new LinkedList<ISubscriber>();
    this.disposeWithMe(() => {
      this.subscribers.clear();
      this.subscribers = undefined as unknown as ILinkedList<ISubscriber>;
    });
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
