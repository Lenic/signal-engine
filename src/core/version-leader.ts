import { ILinkedList, ILinkedNode, IStateNotifier, LinkedList, StateNotifier } from '../utils';
import { DirtyMarkable } from './dirty-markable';
import { IVersionFollower, IVersionLeader, IVersionLeaderOptions } from './types';

export class VersionLeader extends DirtyMarkable implements IVersionLeader {
  private _versionConfirmer: (leader: IVersionLeader) => boolean;
  private _versionNotifier: IStateNotifier<number>;
  private _followers: ILinkedList<IVersionFollower>;

  constructor(options: IVersionLeaderOptions) {
    super(options.isDirty);

    this._versionConfirmer = options.confirm;

    this._versionNotifier = new StateNotifier(1);
    this._followers = new LinkedList<IVersionFollower>();

    this.disposeWithMe(this.onDirty(() => this._followers.forEach((v) => v.markDirty())));
  }

  get version(): number {
    return this._versionNotifier.value;
  }

  onVersionChanged(callback: (version: number) => void): () => void {
    return this._versionNotifier.subscribe(callback);
  }

  confirm(): number {
    if (this._versionConfirmer(this)) {
      this._dirtyNotifier.notify(false);
      this._versionNotifier.notify(this._versionNotifier.value + 1);
    }
    return this._versionNotifier.value;
  }

  appendFollower(follower: IVersionFollower): () => void {
    let node: ILinkedNode<IVersionFollower> | null = this._followers.append(follower);

    node.onRemoved = () => void (node = null);
    return () => node?.removeSelf();
  }
}
