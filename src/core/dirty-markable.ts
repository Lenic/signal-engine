import { Disposable, IStateNotifier, StateNotifier } from '../utils';
import { IDirtyMarkable } from './types';

export class DirtyMarkable extends Disposable implements IDirtyMarkable {
  protected _dirtyNotifier: IStateNotifier<boolean>;

  constructor(isDirty: boolean) {
    super();

    this._dirtyNotifier = new StateNotifier(isDirty);
  }

  get isDirty(): boolean {
    return this._dirtyNotifier.value;
  }

  markDirty(): void {
    if (!this._dirtyNotifier.value) {
      this._dirtyNotifier.notify(true);
    }
  }

  onDirty(callback: () => void): () => void {
    const unsubscribe = this._dirtyNotifier.subscribe((isDirty) => {
      if (isDirty) {
        callback();
      }
    });

    if (this._dirtyNotifier.value) {
      callback();
    }

    return unsubscribe;
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();
    this._dirtyNotifier.dispose();
  }
}
