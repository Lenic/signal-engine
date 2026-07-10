import { DirtyMarkable } from './dirty-markable';
import { IVersionFollower } from './types';

export class VersionFollower extends DirtyMarkable implements IVersionFollower {
  constructor(isDirty: boolean = true) {
    super(isDirty);
  }

  clearDirty(): void {
    this._dirtyNotifier.notify(false);
  }
}
