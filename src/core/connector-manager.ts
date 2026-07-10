import { ErrorScope, ILinkedList, ILinkedNode, LinkedList } from '../utils';
import { globalScheduler } from './scheduler';
import { IConnector, IConnectorManager, IVersionFollower, IVersionLeader } from './types';

export class ConnectorManager implements IConnectorManager {
  private _isInitialized: boolean;
  private _follower: IVersionFollower;
  private _list: ILinkedList<IConnector>;

  private _isExecuting: boolean;
  private _current: ILinkedNode<IConnector> | null;
  private _action: () => void;

  constructor(follower: IVersionFollower, action: () => void) {
    this._current = null;
    this._isExecuting = false;
    this._isInitialized = false;

    this._action = action;
    this._follower = follower;
    this._list = new LinkedList<IConnector>();
  }

  run(): void {
    if (this._isExecuting) {
      throw new Error('[ConnectorManager]: can not run iteratively.');
    }

    const previousIsRunning = globalScheduler.isRunning;
    const previousManager = globalScheduler.connectorManager;
    globalScheduler.connectorManager = this;
    globalScheduler.isRunning = true;
    ErrorScope.current.run(
      (context) => {
        if (!this.shouldRecompute()) return;
        this._isInitialized = true;

        this._current = this._list.head;
        context.capture(() => this._action());

        if (this._current) {
          this._current.value.unsubscribe();
          this._current.removeSelf();
          this._current = this._current.next;
        }
      },
      () => {
        globalScheduler.connectorManager = previousManager;
        globalScheduler.isRunning = previousIsRunning;
      },
    );
  }

  track(provider: IVersionLeader): void {
    try {
      if (!this._current) {
        this._current = this._list.append({
          snapshot: { instance: provider, version: provider.version },
          unsubscribe: provider.appendFollower(this._follower),
        });
        return;
      }

      const { snapshot, unsubscribe } = this._current.value;
      if (snapshot.instance === provider) {
        snapshot.version = provider.version;
        return;
      }

      unsubscribe();
      this._current.value = {
        snapshot: { instance: provider, version: provider.version },
        unsubscribe: provider.appendFollower(this._follower),
      };
    } finally {
      this._current = this._current?.next ?? null;
    }
  }

  private shouldRecompute() {
    if (!this._isInitialized) return true;

    let node = this._list.head;
    while (node) {
      const currentVersion = node.value.snapshot.instance.confirm();
      if (currentVersion !== node.value.snapshot.version) return true;
    }
    return false;
  }
}
