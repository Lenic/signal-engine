import { DirtyMarkable } from './dirty-markable';
import { IVersionFollower, IVersionFollowerOptions } from './types';

export class VersionFollower extends DirtyMarkable implements IVersionFollower {
  constructor(options?: IVersionFollowerOptions) {
    super(options?.isDirty ?? true);
  }

  clearDirty(): void {
    this._dirtyNotifier.notify(false);
  }
}
