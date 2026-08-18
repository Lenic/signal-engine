import { ILinkedList, LinkedList } from '../linked-list';
import { IErrorScope, IErrorScopeContext } from './types';

const store: ILinkedList<IErrorScope> = new LinkedList<IErrorScope>();

function releaseScopeInstance(instance: IErrorScope) {
  if (store.size < 5) {
    store.append(instance);
  }
}

export class ErrorScope implements IErrorScope, IErrorScopeContext {
  private list: unknown[];

  static getInstance(): IErrorScope {
    let node = store.head;
    if (!node) {
      return new ErrorScope();
    }

    const instance = node.value;
    node.removeSelf();
    return instance;
  }

  private constructor() {
    this.list = [];
  }

  push(error: unknown): void {
    this.list.push(error);
  }

  capture(action: () => void): void {
    try {
      action();
    } catch (e) {
      this.list.push(e);
    }
  }

  // The scope hands itself out as the context rather than building one per call: `run` sits on
  // the hottest path in the engine, and a fresh object plus two closures on every invocation was
  // most of what it cost.
  run(callback: (context: IErrorScopeContext) => void, finalize?: () => void): void {
    try {
      callback(this);
    } catch (e) {
      this.list.push(e);
    } finally {
      try {
        finalize?.();
      } catch (e) {
        this.list.push(e);
      }

      // Returned to the store on the way out either way. Releasing only on the failing path -
      // as this used to - left the store permanently empty, so every `getInstance` allocated.
      if (!this.list.length) {
        releaseScopeInstance(this);
        return;
      }

      try {
        if (this.list.length === 1) {
          throw this.list[0];
        } else {
          throw new AggregateError(this.list, '[ErrorScope]: multiple errors occurred.');
        }
      } finally {
        this.list = [];
        releaseScopeInstance(this);
      }
    }
  }
}
