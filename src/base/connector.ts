import type { IConnectible, IConnector, IDisposable, IRunnable } from './types';

export class Connector implements IConnector, IDisposable {
  isDisposed: boolean;

  runnable: IRunnable;
  connectible: IConnectible;
  connectibleVersion: number;

  prevConnectible?: IConnector;
  nextConnectible?: IConnector;

  prevRunnable?: IConnector;
  nextRunnable?: IConnector;

  constructor(connectible: IConnectible, runnable: IRunnable, connectibleVersion: number) {
    this.isDisposed = false;

    this.runnable = runnable;
    this.connectible = connectible;
    this.connectibleVersion = connectibleVersion;

    // append to runnable
    const tailInRunnable = runnable.connectibleTail;
    if (tailInRunnable) {
      tailInRunnable.nextConnectible = this;
    } else {
      runnable.connectibleHead = this;
    }
    this.prevConnectible = tailInRunnable;
    runnable.connectibleTail = this;
    this.nextConnectible = undefined;

    // append to connectible
    const tailInConnectible = connectible.runnableTail;
    if (tailInConnectible) {
      tailInConnectible.nextRunnable = this;
    } else {
      connectible.runnableHead = this;
    }
    this.prevRunnable = tailInConnectible;
    connectible.runnableTail = this;
    this.nextRunnable = undefined;
  }

  updateConnectible(connectible: IConnectible, connectibleVersion: number) {
    // remove
    const prev = this.prevRunnable;
    const next = this.nextRunnable;

    if (prev) prev.nextRunnable = next;
    if (next) next.prevRunnable = prev;

    const previous = this.connectible;
    if (previous.runnableHead === this) previous.runnableHead = next;
    if (previous.runnableTail === this) previous.runnableTail = prev;

    // update
    this.connectible = connectible;
    this.connectibleVersion = connectibleVersion;

    // append
    const tail = connectible.runnableTail;
    if (tail) {
      tail.nextRunnable = this;
    } else {
      connectible.runnableHead = this;
    }

    this.prevRunnable = tail;
    this.nextRunnable = undefined;

    connectible.runnableTail = this;
  }

  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.runnable.connectibleCurrent === this) {
      this.runnable.connectibleCurrent = this.nextConnectible;
    }

    const { connectible, runnable } = this;

    // detach from runnable
    const prevC = this.prevConnectible;
    const nextC = this.nextConnectible;

    if (prevC) {
      prevC.nextConnectible = nextC;
    } else {
      runnable.connectibleHead = nextC;
    }

    if (nextC) {
      nextC.prevConnectible = prevC;
    } else {
      runnable.connectibleTail = prevC;
    }

    this.prevConnectible = undefined;
    this.nextConnectible = undefined;

    // detach from connectible
    const prevR = this.prevRunnable;
    const nextR = this.nextRunnable;

    if (prevR) {
      prevR.nextRunnable = nextR;
    } else {
      connectible.runnableHead = nextR;
    }
    if (nextR) {
      nextR.prevRunnable = prevR;
    } else {
      connectible.runnableTail = prevR;
    }

    this.prevRunnable = undefined;
    this.nextRunnable = undefined;

    // release other properties
    this.connectibleVersion = -1;
    this.runnable = undefined as unknown as IRunnable;
    this.connectible = undefined as unknown as IConnectible;
  }
}
