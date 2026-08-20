import { ILinkedList, ILinkedNode, LinkedList } from '../utils';
import { DirtyMarkable } from './dirty-markable';
import { ISnapshot, IVersionFollower, IVersionLeader, IVersionLeaderOptions } from './types';

const defaultConfirmAction = () => true;

export class VersionLeader extends DirtyMarkable implements IVersionLeader {
  private _trackToken = 0;
  private _trackedSnapshot: ISnapshot<IVersionLeader> | null = null;
  private _version = 0;
  private _versionConfirmer: (leader: IVersionLeader) => boolean;
  // Allocated on the first follower. A signal nobody reads never grows one.
  private _followers: ILinkedList<IVersionFollower> | null;

  constructor(options: IVersionLeaderOptions) {
    super(options.isDirty, options.name);

    this._versionConfirmer = options.confirm ?? defaultConfirmAction;

    this._followers = null;
  }

  /**
   * Propagating to followers is what a leader *is*, not something subscribed to it - keeping it
   * out of the listener slot leaves that slot free for an actual observer.
   */
  protected notifyDirty(): void {
    this._followers?.forEach((v) => v.markDirty());

    super.notifyDirty();
  }

  get version(): number {
    return this._version;
  }

  confirm(): number {
    // The dirt is consumed up front, because confirming it re-enters user code that may dirty
    // this leader again - a memo whose body writes one of its own dependencies does exactly
    // that. Clearing afterwards would wipe that fresh dirt along with the old one, and the
    // leader would stay permanently "clean" while its sources had already moved on.
    const wasDirty = this.isDirty;
    this._isDirty = false;

    // Nobody observes the version - it is polled by readers holding a recorded copy - so moving
    // it needs no notification, and therefore no batch to collect one.
    if (!this.isDisposed && wasDirty && this._versionConfirmer(this)) {
      this._version += 1;
    }

    return this._version;
  }

  trackedBy(token: number): ISnapshot<IVersionLeader> | null {
    return this._trackToken === token ? this._trackedSnapshot : null;
  }

  markTracked(token: number, snapshot: ISnapshot<IVersionLeader>): void {
    this._trackToken = token;
    this._trackedSnapshot = snapshot;
  }

  appendFollower(follower: IVersionFollower): () => void {
    this.assertNotDisposed();

    const followers = (this._followers ??= new LinkedList<IVersionFollower>());
    let node: ILinkedNode<IVersionFollower> | null = followers.append(follower);

    node.onRemoved = () => void (node = null);
    return () => node?.removeSelf();
  }
}
