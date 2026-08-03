import { Disposable, ErrorScope, IDisposable, ILinkedList, ILinkedNode, isDisposable, LinkedList } from '../utils';
import { globalScheduler } from './scheduler';
import { IConnector, IConnectorManager, IVersionFollower, IVersionLeader } from './types';

export class ConnectorManager<T = void> extends Disposable implements IConnectorManager<T> {
  private _name?: string;
  private _isInitialized: boolean;
  private _follower: IVersionFollower;
  private _list: ILinkedList<IConnector>;
  private _adoptedList: ILinkedList<() => void>;

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
    this._adoptedList = new LinkedList<() => void>();
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

        // The previous run's resources belong to the previous run only. Release them before
        // the action produces a new generation, so the two never overlap. Captured, because a
        // failing cleanup must not prevent this recomputation.
        context.capture(() => this.disposeAdopted());

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

  adopt(disposable: IDisposable | (() => void)): void {
    this.checkDisposed();

    this._adoptedList.append(isDisposable(disposable) ? () => void disposable.dispose() : disposable);
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

    this.disposeAdopted();
    this._adoptedList = undefined as unknown as ILinkedList<() => void>;

    this.disconnect();
    this._list = undefined as unknown as ILinkedList<IConnector>;
  }

  private disposeAdopted(): void {
    if (this._adoptedList.size === 0) return;

    // Every adopted resource must be released even when one of them throws, so each release
    // is captured individually and the collected errors are rethrown as one.
    ErrorScope.getInstance().run((context) => this._adoptedList.clear((release) => context.capture(release)));
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
