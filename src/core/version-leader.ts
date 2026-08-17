import { ILinkedList, ILinkedNode, IStateNotifier, LinkedList, StateNotifier } from '../utils';
import { DirtyMarkable } from './dirty-markable';
import { globalScheduler } from './scheduler';
import { ISnapshot, IVersionFollower, IVersionLeader, IVersionLeaderOptions } from './types';

const defaultConfirmAction = () => true;

export class VersionLeader extends DirtyMarkable implements IVersionLeader {
  private _trackToken = 0;
  private _trackedSnapshot: ISnapshot<IVersionLeader> | null = null;
  private _versionConfirmer: (leader: IVersionLeader) => boolean;
  private _versionNotifier: IStateNotifier<number>;
  private _followers: ILinkedList<IVersionFollower>;

  constructor(options: IVersionLeaderOptions) {
    super(options.isDirty, options.name);

    this._versionConfirmer = options.confirm ?? defaultConfirmAction;

    this._versionNotifier = new StateNotifier(0, {
      name: options.name ? `version-notifier-${options.name}` : undefined,
    });
    this._followers = new LinkedList<IVersionFollower>();

    this.disposeWithMe(this.onDirty(() => this._followers.forEach((v) => v.markDirty())));
    // The snapshot points back here, so holding it past disposal would keep this leader's last
    // recorded state alive for no reason.
    this.disposeWithMe(() => void (this._trackedSnapshot = null));
  }

  get version(): number {
    return this._versionNotifier.value;
  }

  onVersionChanged(callback: (version: number) => void): () => void {
    this.checkDisposed();

    return this._versionNotifier.subscribe(callback);
  }

  confirm(): number {
    // The dirt is consumed up front, because confirming it re-enters user code that may dirty
    // this leader again - a memo whose body writes one of its own dependencies does exactly
    // that. Clearing afterwards would wipe that fresh dirt along with the old one, and the
    // leader would stay permanently "clean" while its sources had already moved on.
    const wasDirty = this.isDirty;
    this._dirtyNotifier.notify(false);

    if (!this.isDisposed && wasDirty && this._versionConfirmer(this)) {
      globalScheduler.batch(() => this._versionNotifier.notify(this._versionNotifier.value + 1));
    }

    return this._versionNotifier.value;
  }

  trackedBy(token: number): ISnapshot<IVersionLeader> | null {
    return this._trackToken === token ? this._trackedSnapshot : null;
  }

  markTracked(token: number, snapshot: ISnapshot<IVersionLeader>): void {
    this._trackToken = token;
    this._trackedSnapshot = snapshot;
  }

  appendFollower(follower: IVersionFollower): () => void {
    this.checkDisposed();

    let node: ILinkedNode<IVersionFollower> | null = this._followers.append(follower);

    node.onRemoved = () => void (node = null);
    return () => node?.removeSelf();
  }
}
