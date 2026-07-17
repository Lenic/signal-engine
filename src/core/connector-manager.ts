import { Disposable, ILinkedList, ILinkedNode, LinkedList } from '../utils';
import { globalScheduler } from './scheduler';
import { IConnector, IConnectorManager, IVersionFollower, IVersionLeader } from './types';

export class ConnectorManager<T = void> extends Disposable implements IConnectorManager<T> {
  private _name?: string;
  private _isInitialized: boolean;
  private _follower: IVersionFollower;
  private _list: ILinkedList<IConnector>;

  private _isExecuting: boolean;
  private _current: ILinkedNode<IConnector> | null;
  private _action: () => T;

  constructor(follower: IVersionFollower, action: () => T, name?: string) {
    super();

    this._current = null;
    this._isExecuting = false;
    this._isInitialized = false;

    this._name = name;
    this._action = action;
    this._follower = follower;
    this._list = new LinkedList<IConnector>();
  }

  get name(): string | undefined {
    return this._name;
  }

  run(): T {
    this.checkDisposed();

    if (this._isExecuting) {
      throw new Error('[ConnectorManager]: can not run iteratively.');
    }

    const previousRunning = globalScheduler.isRunning;
    const previousManager = globalScheduler.connectorManager;

    globalScheduler.isRunning = true;
    globalScheduler.connectorManager = this;

    let result: T;
    globalScheduler.batch(
      (context) => {
        if (!this.shouldRecompute()) return;
        this._isInitialized = true;

        this._current = this._list.head;
        context.capture(() => void (result = this._action()));

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
    return result!;
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

  disconnect(): void {
    this._list.forEach((v) => v.unsubscribe());
    this._list.clear();
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();

    this._current = null;
    this._isExecuting = false;
    this._isInitialized = false;

    this._action = undefined as unknown as () => T;
    this._follower = undefined as unknown as IVersionFollower;

    this.disconnect();
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
