import type { IErrorScopeContext } from './types';

let currentDepth = -1;
let errors: unknown[] = [];
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

  push(error: unknown): void {
    this.assertOpen();
    this.assertActive('push()');

    while ((error as { error?: unknown } | null)?.error === ScopeAbortSignal.instance) {
      error = (error as { suppressed: unknown }).suppressed;
    }

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
      pool[i].startCount = 0;
    }

    currentDepth = Math.min(currentDepth, this.iterationDepth - 1);
    this.isOpen = false;
    this.startCount = 0;
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
    const target =
      context instanceof ErrorScopeContext && context.isOpen ? context : currentDepth >= 0 ? pool[currentDepth] : null;
    if (!target) {
      throw new Error('[ErrorScope]: end(context) called while no scope was open.');
    }

    if (pool[currentDepth] !== context) {
      errors.push(new Error('[ErrorScope]: end(context) called in the wrong sequence.'));
    }

    try {
      target.throwIfNewlyFailed();
    } finally {
      target.close();
    }
  }

  [Symbol.dispose](): void {
    ErrorScopeContext.end(this);
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
