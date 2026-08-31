import { Disposable, ErrorScope, IDisposable, ILinkedList, ILinkedNode, isDisposable, LinkedList } from '../utils';
import { globalScheduler } from './scheduler';
import { IConnector, IConnectorManager, ISnapshot, IVersionFollower, IVersionLeader } from './types';

let trackTokenSeq = 0;

export class ConnectorManager<T = void> extends Disposable implements IConnectorManager<T> {
  private _name?: string;
  private _isInitialized: boolean;
  private _follower: IVersionFollower;
  private _list: ILinkedList<IConnector>;
  private _adoptedList: ILinkedList<() => void>;

  private _isExecuting: boolean;
  private _current: ILinkedNode<IConnector> | null;
  private _action: () => T;
  private _trackToken = 0;

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

  get isExecuting(): boolean {
    return this._isExecuting;
  }

  run(): T {
    this.assertNotDisposed();

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
        this._trackToken = ++trackTokenSeq;

        // Guards the action against re-entering *itself* - a memo whose body reads its own
        // value, or two memos reading each other. The window is deliberately just the action:
        // once it has returned, this same manager may legitimately be run again from the flush
        // loop nested inside this very `run` - that is how an effect that writes its own
        // dependency gets its follow-up execution.
        this._isExecuting = true;
        context.capture(() => void (result = this._action()));
        this._isExecuting = false;

        // Same for the action itself - disposing mid-run is a lifecycle event, not an error.
        if (this.isDisposed) return;

        // Slots the action did not claim this time belong to dependencies it no longer reads.
        // `next` is captured before the node goes: `removeSelf` scrubs its links, so reading
        // `next` afterwards would always be `null` and the loop would drop a single node no
        // matter how many the run left behind.
        while (this._current) {
          const next = this._current.next;

          this._current.value.followerNode.removeSelf();
          this._current.removeSelf();
          this._current = next;
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

    const current = this._current;

    // A leader already tracked by *this* run is one dependency however many times it is read,
    // so the repeat is folded into the slot the first read claimed and no cursor moves.
    const tracked = leader.trackedBy(this._trackToken);
    if (tracked) {
      const version = this.confirmWhileAlive(leader);
      if (version === null) return;

      tracked.version = version;
      return;
    }

    // Slots are matched by read order, so a stable dependency set lands here every time.
    if (current && current.value.snapshot.instance === leader) {
      const { snapshot } = current.value;
      const version = this.confirmWhileAlive(leader);
      if (version === null) return;

      snapshot.version = version;
      leader.markTracked(this._trackToken, snapshot);
      this._current = current.next;
      return;
    }

    if (!current) {
      const version = this.confirmWhileAlive(leader);
      if (version === null) return;

      const snapshot: ISnapshot<IVersionLeader> = { instance: leader, version };

      this._list.append({ snapshot, followerNode: leader.appendFollower(this._follower) });
      leader.markTracked(this._trackToken, snapshot);
      this._current = null;
      return;
    }

    current.value.followerNode.removeSelf();
    const version = this.confirmWhileAlive(leader);
    if (version === null) return;

    const snapshot: ISnapshot<IVersionLeader> = { instance: leader, version };

    current.value = { snapshot, followerNode: leader.appendFollower(this._follower) };
    leader.markTracked(this._trackToken, snapshot);
    this._current = current.next;
  }

  /**
   * Confirms a leader's version, reporting `null` when confirming tore this manager down.
   *
   * Every branch of `track` has to route through here: confirming re-enters user code - a memo
   * body - which is free to dispose whoever is reading it. Past that point `_list` is gone and
   * the cursor points at a node that has already been scrubbed, so claiming a slot would throw
   * or quietly record the dependency into an entry nothing owns any more.
   */
  private confirmWhileAlive(leader: IVersionLeader): number | null {
    const version = leader.confirm();

    return this.isDisposed ? null : version;
  }

  adopt(disposable: IDisposable | (() => void)): void {
    // Same reasoning as `track`: an already-disposed manager has no run left to bind a
    // resource to, so the request is ignored rather than rejected.
    if (this.isDisposed) return;

    this._adoptedList.append(isDisposable(disposable) ? () => void disposable.dispose() : disposable);
  }

  disconnect(): void {
    // Every mark this manager handed out points at a slot that is about to vanish. Taking a
    // fresh token retires them all at once, so a read arriving afterwards cannot fold itself
    // into an orphaned snapshot - it claims a real slot and subscribes again.
    this._trackToken = ++trackTokenSeq;

    this._list.clear((v) => v.followerNode.removeSelf());
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

    // Releasing a resource belongs to no reactive scope. Whatever a cleanup reads must not
    // become a dependency - neither of this manager, nor of whoever happens to be running when
    // the disposal is triggered from the outside - and whatever it creates must not be adopted
    // into the very list being drained here. Note that `isRunning` is deliberately left as it
    // is, so writes performed by a cleanup stay batched.
    const previousManager = globalScheduler.connectorManager;
    globalScheduler.connectorManager = undefined;

    // Every adopted resource must be released even when one of them throws, so each release
    // is captured individually and the collected errors are rethrown as one.
    ErrorScope.run(
      (context) => this._adoptedList.clear((release) => context.capture(release)),
      () => void (globalScheduler.connectorManager = previousManager),
    );
  }

  private shouldRecompute() {
    if (!this._isInitialized) return true;

    let node = this._list.head;
    while (node) {
      // `confirm()` re-enters user code - a memo body - which is free to dispose this very
      // manager and tear down every node of `_list`. So everything this iteration still needs
      // is read *before* that call, and disposal is checked *after* it: a scrubbed node reports
      // `undefined` as its value and `null` as its successor.
      const { snapshot } = node.value;
      const recordedVersion = snapshot.version;
      const next = node.next;

      const hasChanged = snapshot.instance.confirm() !== recordedVersion;

      // Disposal outranks a pending change: once confirming has torn this manager down there
      // is nothing left to recompute, and `next` has been scrubbed to `null`.
      if (this.isDisposed) return false;
      if (hasChanged) return true;

      node = next;
    }
    return false;
  }
}
