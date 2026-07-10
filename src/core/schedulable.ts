import { Disposable, IStateNotifier, StateNotifier } from '../utils';
import { ISchedulable } from './types';

export class Schedulable extends Disposable implements ISchedulable {
  private _stateNotifier: IStateNotifier<boolean>;

  get isScheduled(): boolean {
    return this._stateNotifier.value;
  }

  constructor() {
    super();

    this._stateNotifier = new StateNotifier<boolean>(false);
  }

  markScheduled(): void {
    this._stateNotifier.notify(true);
  }

  clearScheduled(): void {
    this._stateNotifier.notify(false);
  }

  onScheduleChange(listener: (scheduled: boolean) => void): () => void {
    return this._stateNotifier.subscribe(listener);
  }

  dispose() {
    if (this.isDisposed) return;

    super.dispose();
    this._stateNotifier.dispose();
  }
}
