import { ILinkedList, ILinkedNode, IStateNotifier, LinkedList, StateNotifier } from '../utils';
import { DirtyMarkable } from './dirty-markable';
import { globalScheduler } from './scheduler';
import { IVersionFollower, IVersionLeader, IVersionLeaderOptions } from './types';

export class VersionLeader extends DirtyMarkable implements IVersionLeader {
  private _versionConfirmer: (leader: IVersionLeader) => boolean;
  private _versionNotifier: IStateNotifier<number>;
  private _followers: ILinkedList<IVersionFollower>;

  constructor(options: IVersionLeaderOptions) {
    super(options.isDirty, options.name);

    this._versionConfirmer = options.confirm;

    this._versionNotifier = new StateNotifier(0, {
      name: options.name ? `version-notifier-${options.name}` : undefined,
    });
    this._followers = new LinkedList<IVersionFollower>();

    this.disposeWithMe(this.onDirty(() => this._followers.forEach((v) => v.markDirty())));
  }

  get version(): number {
    return this._versionNotifier.value;
  }

  onVersionChanged(callback: (version: number) => void): () => void {
    this.checkDisposed();

    return this._versionNotifier.subscribe(callback);
  }

  confirm(): number {
    if (!this.isDisposed && this._versionConfirmer(this)) {
      globalScheduler.batch(() => this._versionNotifier.notify(this._versionNotifier.value + 1));
    }
    this._dirtyNotifier.notify(false);

    return this._versionNotifier.value;
  }

  appendFollower(follower: IVersionFollower): () => void {
    this.checkDisposed();

    let node: ILinkedNode<IVersionFollower> | null = this._followers.append(follower);

    node.onRemoved = () => void (node = null);
    return () => node?.removeSelf();
  }
}
