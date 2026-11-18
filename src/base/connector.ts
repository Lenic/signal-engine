import type { IConnectible, IConnector, IDisposable, IRunnable } from './types';

import { connectibleMethods, runnableMethods } from './constants';

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

    this.prevConnectible = undefined;
    this.nextConnectible = undefined;

    this.prevRunnable = undefined;
    this.nextRunnable = undefined;
  }

  appendToAll() {
    runnableMethods.append(this, this.runnable);
    connectibleMethods.append(this, this.connectible);
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

    runnableMethods.remove(this, this.runnable);
    connectibleMethods.remove(this, this.connectible);

    this.connectibleVersion = -1;
    this.runnable = undefined as unknown as IRunnable;
    this.connectible = undefined as unknown as IConnectible;
  }
}
