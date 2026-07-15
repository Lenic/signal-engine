import { ILinkedList, LinkedList } from '../linked-list';
import { IErrorScope, IErrorScopeContext } from './types';

const store: ILinkedList<IErrorScope> = new LinkedList<IErrorScope>();

function releaseScopeInstance(instance: IErrorScope) {
  if (store.size < 5) {
    store.append(instance);
  }
}

export class ErrorScope implements IErrorScope {
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

  run(callback: (context: IErrorScopeContext) => void, finalize?: () => void): void {
    const context: IErrorScopeContext = {
      push: (error: any) => this.list.push(error),
      capture: (action) => {
        try {
          action();
        } catch (e) {
          this.list.push(e);
        }
      },
    };
    try {
      callback(context);
    } catch (e) {
      this.list.push(e);
    } finally {
      try {
        finalize?.();
      } catch (e) {
        this.list.push(e);
      }

      if (!this.list.length) return;

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
