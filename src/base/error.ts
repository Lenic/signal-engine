const startCounts: number[] = [];

let depth = -1;
let errors: unknown[] = [];

class ScopeAbortSignal {
  private constructor() {}

  static readonly instance = new ScopeAbortSignal();
}

export class ErrorScope {
  private constructor() {}

  static get isActive(): boolean {
    return depth > -1;
  }

  static get hasError(): boolean {
    if (!this.isActive) return false;

    const startCount = startCounts[depth];
    if (startCount === undefined) return false;

    return errors.length !== startCount;
  }

  static record(error: unknown): void {
    if (depth < 0) {
      throw new Error('[ErrorScope]: record() called while no scope was open.');
    }

    if (error === ScopeAbortSignal.instance) return;

    errors.push(error);
  }

  static begin(): number {
    const currentDepth = (depth = depth + 1);
    startCounts[currentDepth] = errors.length;

    return currentDepth;
  }

  static end(level: number): void {
    depth = level - 1;
    if (errors.length !== startCounts[level]) {
      if (level > 0) {
        throw ScopeAbortSignal.instance;
      } else {
        const currentErrors = errors;
        errors = [];

        if (currentErrors.length === 1) {
          throw currentErrors[0];
        } else {
          throw new AggregateError(currentErrors, '[ErrorScope]: multiple errors occurred.');
        }
      }
    }
  }
}
