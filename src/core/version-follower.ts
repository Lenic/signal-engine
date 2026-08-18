import { DirtyMarkable } from './dirty-markable';
import { IVersionFollower, IVersionFollowerOptions } from './types';

export class VersionFollower extends DirtyMarkable implements IVersionFollower {
  constructor(options?: IVersionFollowerOptions) {
    super(options?.isDirty ?? false, options?.name);
  }

  clearDirty(): void {
    this._isDirty = false;
  }
}
