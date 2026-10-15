import type { IBatchScopeContext } from './types';

import { describe, expect, test } from 'vitest';

import { BatchScope } from './main';

/**
 * Every test below opens its scopes the way a production caller does - `begin()` outside the
 * `try`, `end()` in the `finally` - and spells that shape out rather than hiding it behind a
 * helper. Almost everything subtle about this module lives in that shape: which level a context
 * belongs to, which level an `end()` unwinds to, and what happens when a caller gets it wrong.
 * A wrapper that wrote the shape for us would be testing the wrapper.
 */
describe('BatchScope', () => {
  test('a top-level scope opens at depth 0 and runs its body once', () => {
    let ran = 0;
    let depth = -1;

    expect(() => {
      const context = BatchScope.begin();
      try {
        ran++;
        depth = context.depth;
      } finally {
        BatchScope.end(context);
      }
    }).not.toThrow();

    expect(ran).toBe(1);
    expect(depth).toBe(0);
  });

  test('a nested begin() opens the next level instead of being rejected', () => {
    const depths: number[] = [];

    const l1 = BatchScope.begin();
    try {
      depths.push(l1.depth);

      const l2 = BatchScope.begin();
      try {
        depths.push(l2.depth);

        const l3 = BatchScope.begin();
        try {
          depths.push(l3.depth);
        } finally {
          BatchScope.end(l3);
        }

        // Once the inner level has ended, this one is the innermost again.
        depths.push(l2.depth);
      } finally {
        BatchScope.end(l2);
      }

      depths.push(l1.depth);
    } finally {
      BatchScope.end(l1);
    }

    expect(depths).toEqual([0, 1, 2, 1, 0]);
  });

  test('an error thrown inside the scope passes through end() unchanged', () => {
    // BatchScope does not collect errors - whatever the body throws is the caller's to see, and
    // the finally still closes the scope on the way out.
    const boom = new Error('boom');

    expect(() => {
      const context = BatchScope.begin();
      try {
        throw boom;
      } finally {
        BatchScope.end(context);
      }
    }).toThrow(boom);

    expectHealthy();
  });

  test('an error thrown from a nested scope unwinds every level it passes through', () => {
    const boom = new Error('inner boom');
    const trace: string[] = [];

    expect(() => {
      const outer = BatchScope.begin();
      try {
        trace.push('before');

        const inner = BatchScope.begin();
        try {
          throw boom;
        } finally {
          BatchScope.end(inner);
        }
      } finally {
        BatchScope.end(outer);
      }
    }).toThrow(boom);

    expect(trace).toEqual(['before']);
    expectHealthy();
  });

  test('reading depth from an outer context while an inner scope is open is refused', () => {
    // Only the innermost open level is active. Reaching past it is a programming error, and it
    // fails loudly rather than answering for the wrong level.
    const outer = BatchScope.begin();
    try {
      const inner = BatchScope.begin();
      try {
        expect(() => outer.depth).toThrow('[BatchScope]: depth called at the wrong iteration depth.');
      } finally {
        BatchScope.end(inner);
      }
    } finally {
      BatchScope.end(outer);
    }
  });

  test('sequential runs reuse the same frame', () => {
    const collect = (): IBatchScopeContext => {
      const context = BatchScope.begin();
      try {
        return context;
      } finally {
        BatchScope.end(context);
      }
    };

    // Nothing observable depends on this, but it is the whole point of pooling one frame per
    // depth: without it, every run would allocate.
    expect(collect()).toBe(collect());

    // A run that throws still returns its frame, so the next one at that depth picks it up again.
    const first = collect();
    expect(() => {
      const context = BatchScope.begin();
      try {
        throw new Error('boom');
      } finally {
        BatchScope.end(context);
      }
    }).toThrow('boom');
    expect(collect()).toBe(first);
  });

  test('each depth has its own frame', () => {
    const outer = BatchScope.begin();
    try {
      const inner = BatchScope.begin();
      try {
        expect(inner).not.toBe(outer);
      } finally {
        BatchScope.end(inner);
      }
    } finally {
      BatchScope.end(outer);
    }
  });

  test('a context used after its run has ended throws instead of answering', () => {
    const leaked = BatchScope.begin();
    BatchScope.end(leaked);

    expect(() => leaked.depth).toThrow('[BatchScope]: context used outside its scope.');
    expectHealthy();
  });

  test('isBatching is true exactly while some scope is open', () => {
    const trace: boolean[] = [BatchScope.isBatching];

    const context = BatchScope.begin();
    try {
      trace.push(BatchScope.isBatching);
    } finally {
      BatchScope.end(context);
    }

    trace.push(BatchScope.isBatching);

    expect(trace).toEqual([false, true, false]);
  });

  test('isBatching stays true until the outermost scope ends', () => {
    // Callers use this to decide whether to defer work, so ending an inner level must not make
    // it look as if the batch is over while its parent is still running.
    const trace: boolean[] = [];

    const outer = BatchScope.begin();
    try {
      const inner = BatchScope.begin();
      try {
        trace.push(BatchScope.isBatching);
      } finally {
        BatchScope.end(inner);
      }

      trace.push(BatchScope.isBatching);
    } finally {
      BatchScope.end(outer);
    }

    trace.push(BatchScope.isBatching);

    expect(trace).toEqual([true, true, false]);
  });

  test('isBatching is false again after a scope whose body threw', () => {
    expect(() => {
      const outer = BatchScope.begin();
      try {
        const inner = BatchScope.begin();
        try {
          throw new Error('boom');
        } finally {
          BatchScope.end(inner);
        }
      } finally {
        BatchScope.end(outer);
      }
    }).toThrow('boom');

    expect(BatchScope.isBatching).toBe(false);
  });
});

/**
 * Every misuse below deliberately corrupts module state, and the module is a singleton shared by
 * the whole file. Each of those tests ends with this, so a regression in the recovery paths
 * fails where it was caused instead of surfacing as a baffling failure in some later test.
 */
function expectHealthy(): void {
  // A misuse that left any level open would keep every later caller deferring its work forever.
  expect(BatchScope.isBatching).toBe(false);

  const depths: number[] = [];

  expect(() => {
    const outer = BatchScope.begin();
    try {
      depths.push(outer.depth);

      const inner = BatchScope.begin();
      try {
        depths.push(inner.depth);
      } finally {
        BatchScope.end(inner);
      }

      depths.push(outer.depth);
    } finally {
      BatchScope.end(outer);
    }
  }).not.toThrow();

  // Fully unwound: the next scope starts from the top again.
  expect(depths).toEqual([0, 1, 0]);
}

describe('BatchScope misuse recovery', () => {
  // A scope is only well defined while its begin/end are balanced. None of these are supported
  // usage - they are what happens when a caller gets the try/finally wrong, and the point of
  // each test is that the module reports the mistake and then keeps working. end() closes the
  // scope before the report leaves it, so a caller that sees the error is already unwound.

  test('an inner scope that is never ended is reclaimed by its parent', () => {
    let inner!: IBatchScopeContext;

    const outer = BatchScope.begin();
    try {
      inner = BatchScope.begin(); // depth 1, never ended - this is the mistake
    } finally {
      expect(() => BatchScope.end(outer)).toThrow('[BatchScope]: end(context) called in the wrong sequence.');
    }

    // The parent's end() closed the forgotten level along with its own.
    expect(() => inner.depth).toThrow('[BatchScope]: context used outside its scope.');
    expectHealthy();
  });

  test('end() given a foreign object still unwinds whatever is open', () => {
    // The common slip: the finally passes the wrong variable. end() cannot honour an argument
    // that designates no live scope, so it unwinds the innermost open one - which is exactly the
    // scope this caller meant. Returning instead would leave it open with nothing to close it.
    const context = BatchScope.begin();
    try {
      // work
    } finally {
      expect(() => BatchScope.end({} as unknown as IBatchScopeContext)).toThrow(
        '[BatchScope]: end(context) called in the wrong sequence.',
      );
    }

    expect(() => context.depth).toThrow('[BatchScope]: context used outside its scope.');
    expectHealthy();
  });

  test('end() given a closed frame from another depth behaves the same', () => {
    // Same shape as above, but the argument is a genuine frame rather than a foreign object -
    // it exercises the staleness half of the check instead of the instanceof half.
    let stale!: IBatchScopeContext;

    const warmup = BatchScope.begin();
    try {
      stale = BatchScope.begin();
      BatchScope.end(stale);
    } finally {
      BatchScope.end(warmup);
    }

    const context = BatchScope.begin();
    try {
      // work
    } finally {
      expect(() => BatchScope.end(stale)).toThrow('[BatchScope]: end(context) called in the wrong sequence.');
    }

    expect(() => context.depth).toThrow('[BatchScope]: context used outside its scope.');
    expectHealthy();
  });

  test('end() with no scope open reports the misuse', () => {
    const context = BatchScope.begin();
    BatchScope.end(context);

    expect(() => BatchScope.end(context)).toThrow('[BatchScope]: end(context) called while no scope was open.');
    expectHealthy();
  });

  test('a stale frame ended after its parent already ended is refused', () => {
    // The frame was reclaimed by its parent's end(), so by the time its own end() arrives there
    // is nothing left to close.
    const outer = BatchScope.begin();
    const inner = BatchScope.begin();

    expect(() => BatchScope.end(outer)).toThrow('[BatchScope]: end(context) called in the wrong sequence.');
    expect(() => BatchScope.end(inner)).toThrow('[BatchScope]: end(context) called while no scope was open.');
    expectHealthy();
  });

  test('runaway nesting is stopped without leaking the depth', () => {
    // begin() commits currentDepth only after open() succeeds, so tripping the ceiling does not
    // leave the module one level deeper than it thinks.
    const recurse = (n: number): void => {
      const context = BatchScope.begin();
      try {
        if (n > 0) recurse(n - 1);
      } finally {
        BatchScope.end(context);
      }
    };

    expect(() => recurse(102)).toThrow(
      '[BatchScope]: the current iteration depth exceeds the maximum iteration depth.',
    );
    expectHealthy();
  });
});
