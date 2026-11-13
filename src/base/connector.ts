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
    this.assertNotDisposed();

    runnableMethods.append(this, this.runnable);
    connectibleMethods.append(this, this.connectible);
  }

  updateConnectible(connectible: IConnectible, connectibleVersion: number) {
    this.assertNotDisposed();

    connectibleMethods.remove(this, this.connectible);

    this.connectible = connectible;
    this.connectibleVersion = connectibleVersion;

    connectibleMethods.append(this, this.connectible);
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

  private assertNotDisposed() {
    if (this.isDisposed) {
      throw new Error('[Connector]: Object is disposed.');
    }
  }
}
