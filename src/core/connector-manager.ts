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
        // A cleanup is allowed to dispose this manager. That ends the run: there is no new
        // generation left to produce, and `_list` is already gone.
        if (this.isDisposed) return;

        this._current = this._list.head;
        context.capture(() => void (result = this._action()));
        // Same for the action itself - disposing mid-run is a lifecycle event, not an error.
        if (this.isDisposed) return;

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
    // An action is free to dispose itself and keep reading afterwards. Those reads belong to
    // nobody, so they are simply left untracked - throwing here would turn a legitimate
    // lifecycle event into an exception raised inside user code.
    if (this.isDisposed) return;

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
    // Same reasoning as `track`: an already-disposed manager has no run left to bind a
    // resource to, so the request is ignored rather than rejected.
    if (this.isDisposed) return;

    this._adoptedList.append(isDisposable(disposable) ? () => void disposable.dispose() : disposable);
  }

  disconnect(): void {
    this._list.clear((v) => v.unsubscribe());
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
      // `confirm()` re-enters user code - a memo body - which is free to dispose this very
      // manager and hand every node of `_list` back to the pool. So everything this iteration
      // still needs is read *before* that call, and disposal is checked *after* it: a node
      // that has been released reports `undefined` as its value and `null` as its successor.
      const { snapshot } = node.value;
      const recordedVersion = snapshot.version;
      const next = node.next;

      const hasChanged = snapshot.instance.confirm() !== recordedVersion;

      // Disposal outranks a pending change: once confirming has torn this manager down there
      // is nothing left to recompute, and `next` now points into the pool.
      if (this.isDisposed) return false;
      if (hasChanged) return true;

      node = next;
    }
    return false;
  }
}
