import type { IAction } from './types';

let depth = -1;

export class BatchScope {
  static onBeforeExit?: IAction = undefined;

  private constructor() {}

  static get isBatching() {
    return depth > -1;
  }

  static begin(): number {
    return (depth = depth + 1);
  }

  static end(level: number): void {
    if (level > depth) return;

    try {
      if (level === 0) {
        this.onBeforeExit?.();
      }
    } finally {
      depth = level - 1;
    }
  }
}
