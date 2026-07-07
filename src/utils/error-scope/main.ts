import { IErrorScope, IErrorScopeContext } from './types';

export class ErrorScope implements IErrorScope {
  private list: unknown[];
  private isExecuting: boolean;

  static current: IErrorScope = new ErrorScope();

  private constructor() {
    this.list = [];
    this.isExecuting = false;
  }

  run(callback: (context: IErrorScopeContext) => void): void {
    if (this.isExecuting) {
      throw new Error('[ErrorScope]: the run method cannot be nested.');
    }

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
      this.isExecuting = true;
      callback(context);
    } catch (e) {
      this.list.push(e);
    } finally {
      this.isExecuting = false;
      if (!this.list.length) return;

      if (this.list.length === 1) {
        throw this.list[0];
      } else {
        throw new AggregateError(this.list, '[ErrorScope]: multiple errors occurred.');
      }
    }
  }
}
