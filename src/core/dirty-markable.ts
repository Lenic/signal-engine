import { Disposable } from '../utils';
import { globalScheduler } from './scheduler';
import { IDirtyMarkable } from './types';

export class DirtyMarkable extends Disposable implements IDirtyMarkable {
  protected _name?: string;
  protected _isDirty: boolean;

  onDirty: (() => void) | null;

  constructor(isDirty: boolean, name?: string) {
    super();

    this._name = name;
    this._isDirty = isDirty;
    this.onDirty = null;
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

    // A batch already open around us is a batch already open around whoever called us too - a
    // failure here propagates straight into their own try/catch (or the outermost one, if it
    // takes that many frames), the same place it would land if this call opened its own
    // beginBatch/endBatch pair and immediately deferred to a context nobody but the outermost
    // frame actually owns. Skipping that pair here isn't just fewer method calls: this is one of
    // the hottest calls in the library, made once per dependency on every dirty propagation, and
    // paying for it unconditionally is what a batched write with many signals feels first.
    if (globalScheduler.isRunning) {
      this.notifyDirty();
      return;
    }

    // Turning dirty can put effects on the schedule, and those have to land inside a batch.
    globalScheduler.isRunning = true;

    const context = globalScheduler.beginBatch();
    try {
      this.notifyDirty();
    } catch (e) {
      context.push(e);
    } finally {
      globalScheduler.isRunning = false;
      globalScheduler.endBatch(context);
    }
  }

  /**
   * What this object does the moment it turns dirty. Subclasses override to add their own
   * propagation and call `super` so the registered listener still runs.
   */
  protected notifyDirty(): void {
    this.onDirty?.();
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();
    this.onDirty = null;
  }
}
