import { Disposable, IStateNotifier, StateNotifier } from '../utils';
import { globalScheduler } from './scheduler';
import { IDirtyMarkable } from './types';

export class DirtyMarkable extends Disposable implements IDirtyMarkable {
  protected _name?: string;
  protected _dirtyNotifier: IStateNotifier<boolean>;

  constructor(isDirty: boolean, name?: string) {
    super();

    this._name = name;
    this._dirtyNotifier = new StateNotifier(isDirty, { name: name ? `dirty-notifier-${name}` : undefined });
  }

  get name(): string | undefined {
    return this._name;
  }

  get isDirty(): boolean {
    return this._dirtyNotifier.value;
  }

  markDirty(): void {
    if (!this._dirtyNotifier.value) {
      globalScheduler.runBatched(() => this._dirtyNotifier.notify(true));
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
