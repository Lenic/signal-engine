import { Disposable, ILinkedList, ILinkedNode, LinkedList } from '../utils';
import { globalScheduler } from './scheduler';
import { IConnector, IConnectorManager, IVersionFollower, IVersionLeader } from './types';

export class ConnectorManager extends Disposable implements IConnectorManager {
  private _isInitialized: boolean;
  private _follower: IVersionFollower;
  private _list: ILinkedList<IConnector>;

  private _isExecuting: boolean;
  private _current: ILinkedNode<IConnector> | null;
  private _action: () => void;

  constructor(follower: IVersionFollower, action: () => void) {
    super();

    this._current = null;
    this._isExecuting = false;
    this._isInitialized = false;

    this._action = action;
    this._follower = follower;
    this._list = new LinkedList<IConnector>();
  }

  run(): void {
    this.checkDisposed();

    if (this._isExecuting) {
      throw new Error('[ConnectorManager]: can not run iteratively.');
    }

    const previousRunning = globalScheduler.isRunning;
    const previousManager = globalScheduler.connectorManager;

    globalScheduler.isRunning = true;
    globalScheduler.connectorManager = this;

    globalScheduler.batch(
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
        this._isExecuting = false;

        globalScheduler.isRunning = previousRunning;
        globalScheduler.connectorManager = previousManager;
      },
    );
  }

  track(leader: IVersionLeader): void {
    this.checkDisposed();

    try {
      if (!this._current) {
        this._current = this._list.append({
          snapshot: { instance: leader, version: leader.confirm() },
          unsubscribe: leader.appendFollower(this._follower),
        });
        return;
      }

      const { snapshot, unsubscribe } = this._current.value;
      if (snapshot.instance === leader) {
        snapshot.version = leader.confirm();
        return;
      }

      unsubscribe();
      this._current.value = {
        snapshot: { instance: leader, version: leader.confirm() },
        unsubscribe: leader.appendFollower(this._follower),
      };
    } finally {
      this._current = this._current?.next ?? null;
    }
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();

    this._current = null;
    this._isExecuting = false;
    this._isInitialized = false;

    this._action = undefined as unknown as () => void;
    this._follower = undefined as unknown as IVersionFollower;

    this._list.forEach((v) => v.unsubscribe());
    this._list.clear();
    this._list = undefined as unknown as ILinkedList<IConnector>;
  }

  private shouldRecompute() {
    if (!this._isInitialized) return true;

    let node = this._list.head;
    while (node) {
      const currentVersion = node.value.snapshot.instance.confirm();
      if (currentVersion !== node.value.snapshot.version) return true;
      node = node.next;
    }
    return false;
  }
}
