import type { IBatchScopeContext } from './types';

let currentDepth = -1;
const MAX_ITERATION_DEPTH = 100;
const pool: BatchScopeContext[] = [];

class BatchScopeContext implements IBatchScopeContext {
  private isOpen: boolean;
  private readonly iterationDepth: number;

  private constructor(iterationDepth: number) {
    this.isOpen = false;
    this.iterationDepth = iterationDepth;
  }

  get depth(): number {
    this.assertOpen();
    this.assertActive('depth');

    return this.iterationDepth;
  }

  private open(): void {
    if (this.isOpen) {
      throw new Error('[BatchScope]: begin() called while a scope was already open.');
    }

    this.isOpen = true;
  }

  private close(): void {
    for (let i = currentDepth; i > this.iterationDepth; i--) {
      pool[i].isOpen = false;
    }

    currentDepth = Math.min(currentDepth, this.iterationDepth - 1);
    this.isOpen = false;
  }

  private assertOpen(): void {
    if (!this.isOpen) {
      throw new Error('[BatchScope]: context used outside its scope.');
    }
  }

  private assertActive(methodName: string): void {
    if (this.iterationDepth !== currentDepth) {
      throw new Error(`[BatchScope]: ${methodName} called at the wrong iteration depth.`);
    }
  }

  static begin(): IBatchScopeContext {
    const nextDepth = currentDepth + 1;

    if (nextDepth > MAX_ITERATION_DEPTH) {
      throw new Error('[BatchScope]: the current iteration depth exceeds the maximum iteration depth.');
    }

    let context = pool[nextDepth];
    if (!context) {
      context = new BatchScopeContext(nextDepth);
      pool[nextDepth] = context;
    }

    context.open();
    currentDepth = nextDepth;

    return context;
  }

  static end(context: IBatchScopeContext): void {
    const target =
      context instanceof BatchScopeContext && context.isOpen ? context : currentDepth >= 0 ? pool[currentDepth] : null;
    if (!target) {
      throw new Error('[BatchScope]: end(context) called while no scope was open.');
    }

    try {
      if (pool[currentDepth] !== context) {
        throw new Error('[BatchScope]: end(context) called in the wrong sequence.');
      }
    } finally {
      target.close();
    }
  }
}

export class BatchScope {
  private constructor() {}

  static get isBatching() {
    return currentDepth > -1;
  }

  static onExited?: (depth: number) => void;

  static begin(): IBatchScopeContext {
    return BatchScopeContext.begin();
  }

  static end(context: IBatchScopeContext): void {
    try {
      return BatchScopeContext.end(context);
    } finally {
      this.onExited?.(currentDepth);
    }
  }
}
