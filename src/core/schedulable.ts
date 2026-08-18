import { Disposable } from '../utils';
import { ISchedulable } from './types';

export class Schedulable extends Disposable implements ISchedulable {
  private _name?: string;
  private _isScheduled: boolean;
  private _listener: ((scheduled: boolean) => void) | null;

  constructor(name?: string) {
    super();

    this._name = name;
    this._isScheduled = false;
    this._listener = null;
  }

  get name(): string | undefined {
    return this._name;
  }

  get isScheduled(): boolean {
    return this._isScheduled;
  }

  markScheduled(): void {
    // Re-marking something already scheduled is a no-op, which is what keeps one queue entry
    // from turning into several.
    if (this._isScheduled) return;

    this._isScheduled = true;
    this._listener?.(true);
  }

  clearScheduled(): void {
    if (!this._isScheduled) return;

    this._isScheduled = false;
    this._listener?.(false);
  }

  onScheduleChange(listener: (scheduled: boolean) => void): () => void {
    if (this._listener) {
      throw new Error(`[Schedulable]: ${this._name ?? 'this object'} already has a schedule listener.`);
    }

    this._listener = listener;

    return () => {
      if (this._listener === listener) {
        this._listener = null;
      }
    };
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();
    this._listener = null;
  }
}
