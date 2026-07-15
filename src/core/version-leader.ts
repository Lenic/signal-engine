import { ILinkedList, ILinkedNode, IStateNotifier, LinkedList, StateNotifier } from '../utils';
import { DirtyMarkable } from './dirty-markable';
import { IVersionFollower, IVersionLeader } from './types';

export class VersionLeader extends DirtyMarkable implements IVersionLeader {
  private _versionConfirmer: (leader: IVersionLeader) => boolean;
  private _versionNotifier: IStateNotifier<number>;
  private _followers: ILinkedList<IVersionFollower>;

  constructor(versionConfirmer: (leader: IVersionLeader) => boolean, isDirty: boolean) {
    super(isDirty);

    this._versionConfirmer = versionConfirmer;

    this._versionNotifier = new StateNotifier(1);
    this._followers = new LinkedList<IVersionFollower>();

    this.disposeWithMe(
      this.onDirty(() => {
        let node = this._followers.head;
        while (node) {
          node.value.markDirty();
          node = node.next;
        }
      }),
    );
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
