import { IErrorScopeContext } from './types';

let currentDepth = -1;
let errors: any[] = [];
const MAX_ITERATION_DEPTH = 100;
const pool: ErrorScopeContext[] = [];

export class ScopeAbortSignal {
  private constructor() {}

  static readonly instance = new ScopeAbortSignal();
}

class ErrorScopeContext implements IErrorScopeContext {
  private isOpen: boolean;
  private startCount: number;
  private readonly iterationDepth: number;

  private constructor(iterationDepth: number) {
    this.isOpen = false;
    this.startCount = 0;
    this.iterationDepth = iterationDepth;
  }

  get hasErrors(): boolean {
    this.assertOpen();
    this.assertActive('hasErrors');

    return errors.length > this.startCount;
  }

  push(error: any): void {
    this.assertOpen();
    this.assertActive('push()');

    if (error === ScopeAbortSignal.instance) return;

    errors.push(error);
  }

  private open(): void {
    if (this.isOpen) {
      throw new Error('[ErrorScope]: begin() called while a scope was already open.');
    }

    this.isOpen = true;
    this.startCount = errors.length;
  }

  private close(): void {
    for (let i = currentDepth; i > this.iterationDepth; i--) {
      pool[i].isOpen = false;
    }

    currentDepth = Math.min(currentDepth, this.iterationDepth - 1);
    this.isOpen = false;
  }

  private throwIfNewlyFailed(): void {
    if (errors.length <= this.startCount) return;

    if (this.iterationDepth > 0) {
      throw ScopeAbortSignal.instance;
    }

    try {
      if (errors.length === 1) {
        throw errors[0];
      } else {
        throw new AggregateError(errors, '[ErrorScope]: multiple errors occurred.');
      }
    } finally {
      errors = [];
    }
  }

  private assertOpen(): void {
    if (!this.isOpen) {
      throw new Error('[ErrorScope]: context used outside its scope.');
    }
  }

  private assertActive(methodName: string): void {
    if (this.iterationDepth !== currentDepth) {
      throw new Error(`[ErrorScope]: ${methodName} called at the wrong iteration depth.`);
    }
  }

  static begin(): IErrorScopeContext {
    const nextDepth = currentDepth + 1;

    if (nextDepth > MAX_ITERATION_DEPTH) {
      throw new Error('[ErrorScope]: the current iteration depth exceeds the maximum iteration depth.');
    }

    let context = pool[nextDepth];
    if (!context) {
      context = new ErrorScopeContext(nextDepth);
      pool[nextDepth] = context;
    }

    context.open();
    currentDepth = nextDepth;

    return context;
  }

  static end(context: IErrorScopeContext): void {
    const internalContext = context instanceof ErrorScopeContext ? context : null;

    if (!internalContext) return;
    if (!internalContext.isOpen) return;

    if (pool[currentDepth] !== context) {
      errors.push(new Error('[ErrorScope]: end(context) called in the wrong sequence.'));
    }

    try {
      internalContext.throwIfNewlyFailed();
    } finally {
      internalContext.close();
    }
  }
}

export class ErrorScope {
  private constructor() {}

  static begin(): IErrorScopeContext {
    return ErrorScopeContext.begin();
  }

  static end(context: IErrorScopeContext): void {
    return ErrorScopeContext.end(context);
  }
}
