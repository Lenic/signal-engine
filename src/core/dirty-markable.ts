import { Disposable } from '../utils';
import { globalScheduler } from './scheduler';
import { IDirtyMarkable } from './types';

export class DirtyMarkable extends Disposable implements IDirtyMarkable {
  protected _name?: string;
  protected _isDirty: boolean;

  private _listener: (() => void) | null;

  constructor(isDirty: boolean, name?: string) {
    super();

    this._name = name;
    this._isDirty = isDirty;
    this._listener = null;
  }

  get name(): string | undefined {
    return this._name;
  }

  get isDirty(): boolean {
    return this._isDirty;
  }

  markDirty(): void {
    if (this._isDirty) return;

    this._isDirty = true;
    // Turning dirty can put effects on the schedule, and those have to land inside a batch.
    globalScheduler.runBatched(() => this.notifyDirty());
  }

  onDirty(callback: () => void): () => void {
    if (this._listener) {
      throw new Error(`[DirtyMarkable]: ${this._name ?? 'this object'} already has a dirty listener.`);
    }

    this._listener = callback;

    if (this._isDirty) {
      callback();
    }

    return () => {
      if (this._listener === callback) {
        this._listener = null;
      }
    };
  }

  /**
   * What this object does the moment it turns dirty. Subclasses override to add their own
   * propagation and call `super` so the registered listener still runs.
   */
  protected notifyDirty(): void {
    this._listener?.();
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();
    this._listener = null;
  }
}
