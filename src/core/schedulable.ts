import { Disposable } from '../utils';
import { ISchedulable } from './types';

export class Schedulable extends Disposable implements ISchedulable {
  private _name?: string;
  private _isScheduled: boolean;

  onScheduleChange: ((scheduled: boolean) => void) | null;

  constructor(name?: string) {
    super();

    this._name = name;
    this._isScheduled = false;
    this.onScheduleChange = null;
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
    this.onScheduleChange?.(true);
  }

  clearScheduled(): void {
    if (!this._isScheduled) return;

    this._isScheduled = false;
    this.onScheduleChange?.(false);
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();
    this.onScheduleChange = null;
  }
}
