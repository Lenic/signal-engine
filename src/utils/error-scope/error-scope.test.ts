import type { IErrorScopeContext } from './types';

import { describe, expect, test } from 'vitest';

import { ErrorScope, ScopeAbortSignal } from './main';

/**
 * Every test below opens its scopes the way a production caller does - `begin()` outside the
 * `try`, `end()` in the `finally` - and spells that shape out rather than hiding it behind a
 * helper. Almost everything subtle about this module lives in that shape: which level a `push`
 * is attributed to, which level an `end()` unwinds to, and what happens when a caller gets it
 * wrong. A wrapper that wrote the shape for us would be testing the wrapper.
 *
 * Where a test needs to inspect what was thrown, the scope sits inside the test's own
 * `try`/`catch`; the inner `try`/`finally` is the production shape.
 */
describe('ErrorScope', () => {
  test('a scope with nothing to report throws nothing', () => {
    let ran = 0;

    expect(() => {
      const context = ErrorScope.begin();
      try {
        ran++;
      } finally {
        ErrorScope.end(context);
      }
    }).not.toThrow();

    expect(ran).toBe(1);
  });

  test('a lone error surfaces unchanged rather than wrapped', () => {
    const boom = new Error('boom');

    expect(() => {
      const context = ErrorScope.begin();
      try {
        context.push(boom);
      } finally {
        ErrorScope.end(context);
      }
    }).toThrow(boom);
  });

  test('errors from separate steps are all reported together', () => {
    const order: string[] = [];
    let caught: unknown;

    try {
      const context = ErrorScope.begin();
      try {
        try {
          order.push('first');
          throw new Error('first failed');
        } catch (e) {
          context.push(e);
        }

        order.push('second');

        try {
          order.push('third');
          throw new Error('third failed');
        } catch (e) {
          context.push(e);
        }
      } finally {
        ErrorScope.end(context);
      }
    } catch (e) {
      caught = e;
    }

    // The point of catching each step on its own: a failure does not stop the steps queued
    // behind it.
    expect(order).toEqual(['first', 'second', 'third']);
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'first failed',
      'third failed',
    ]);
  });

  test('a failing cleanup step is reported alongside the failure it followed', () => {
    // The canonical batch shape: the work fails, cleanup runs anyway and fails too, and the
    // caller is owed both. Neither error may swallow the other.
    let cleanedUp = 0;
    let caught: unknown;

    try {
      const context = ErrorScope.begin();
      try {
        try {
          throw new Error('work failed');
        } catch (e) {
          context.push(e);
        }

        try {
          cleanedUp++;
          throw new Error('cleanup failed');
        } catch (e) {
          context.push(e);
        }
      } finally {
        ErrorScope.end(context);
      }
    } catch (e) {
      caught = e;
    }

    expect(cleanedUp).toBe(1);
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'work failed',
      'cleanup failed',
    ]);
  });

  test('a reused scope never carries errors over into the next run', () => {
    // Frames are pooled and handed out again. A run that reports errors must leave nothing
    // behind for whoever picks that frame up next.
    for (let i = 0; i < 20; i++) {
      expect(() => {
        const context = ErrorScope.begin();
        try {
          context.push(new Error('failure ' + i));
        } finally {
          ErrorScope.end(context);
        }
      }).toThrow('failure ' + i);
    }

    let ran = 0;
    expect(() => {
      const context = ErrorScope.begin();
      try {
        ran++;
      } finally {
        ErrorScope.end(context);
      }
    }).not.toThrow();
    expect(ran).toBe(1);
  });

  test('a nested begin() opens another level instead of being rejected', () => {
    // This used to be forbidden: ErrorScope held one context and begin() threw if a scope was
    // already open. Nesting is the whole point now, so the same call has to succeed - and the
    // outer scope still reports its own error normally afterwards.
    let outerCaught: unknown;
    let innerRan = false;

    try {
      const outer = ErrorScope.begin();
      try {
        const inner = ErrorScope.begin();
        try {
          innerRan = true;
        } finally {
          ErrorScope.end(inner);
        }

        outer.push(new Error('outer-a'));
      } finally {
        ErrorScope.end(outer);
      }
    } catch (e) {
      outerCaught = e;
    }

    expect(innerRan).toBe(true);
    expect((outerCaught as Error).message).toBe('outer-a');
  });

  test('a nested scope that fails aborts the rest of its parent', () => {
    // The reason a failing inner scope throws at all: with one context per level, end() would
    // throw the real error and the parent would catch and re-push it. Sharing a single error
    // array means the error is already recorded, so the inner level throws ScopeAbortSignal
    // instead - same control flow, no double counting.
    const trace: string[] = [];
    let caught: unknown;

    try {
      const outer = ErrorScope.begin();
      try {
        trace.push('before');

        const inner = ErrorScope.begin();
        try {
          inner.push(new Error('inner boom'));
        } finally {
          ErrorScope.end(inner);
        }

        trace.push('after');
      } catch (e) {
        outer.push(e);
      } finally {
        ErrorScope.end(outer);
      }
    } catch (e) {
      caught = e;
    }

    expect(trace).toEqual(['before']);
    // One error, so it surfaces unwrapped - the abort signal itself is swallowed by push().
    expect((caught as Error).message).toBe('inner boom');
    expect(caught).not.toBeInstanceOf(AggregateError);
  });

  test('a nested scope with nothing to report leaves its parent running', () => {
    // Companion to the test above, and the reason each level records the error count it opened
    // at: a scope that added nothing must not abort its parent just because errors from an
    // outer level happen to be sitting in the shared array.
    const trace: string[] = [];

    expect(() => {
      const outer = ErrorScope.begin();
      try {
        trace.push('before');

        const inner = ErrorScope.begin();
        try {
          trace.push('inner');
        } finally {
          ErrorScope.end(inner);
        }

        trace.push('after');
      } finally {
        ErrorScope.end(outer);
      }
    }).not.toThrow();

    expect(trace).toEqual(['before', 'inner', 'after']);
  });

  test('an inner scope aborts with ScopeAbortSignal rather than the error itself', () => {
    // What a parent's catch actually receives from a failing nested end(), spelled out.
    let innerCaught: unknown;

    const outer = ErrorScope.begin();
    try {
      const inner = ErrorScope.begin();
      try {
        inner.push(new Error('inner boom'));
      } finally {
        try {
          ErrorScope.end(inner);
        } catch (e) {
          innerCaught = e;
        }
      }

      outer.push(innerCaught);
    } finally {
      expect(() => ErrorScope.end(outer)).toThrow('inner boom');
    }

    expect(innerCaught).toBe(ScopeAbortSignal.instance);
  });

  test('errors from every level arrive flattened into one AggregateError', () => {
    // Real nested contexts would nest the AggregateErrors too. Sharing one array flattens them,
    // which is what a batch flush wants: one error listing every leaf failure, in order.
    let caught: unknown;

    try {
      const l1 = ErrorScope.begin();
      try {
        try {
          const l2 = ErrorScope.begin();
          try {
            l2.push(new Error('b'));

            const l3 = ErrorScope.begin();
            try {
              l3.push(new Error('a'));
            } finally {
              ErrorScope.end(l3);
            }
          } catch (e) {
            l2.push(e);
          } finally {
            ErrorScope.end(l2);
          }
        } catch (e) {
          l1.push(e);
        }

        l1.push(new Error('c'));
      } finally {
        ErrorScope.end(l1);
      }
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual(['b', 'a', 'c']);
  });

  test('pushing to an outer context while an inner scope is open is refused', () => {
    // Every level shares one error array, so a push can only be attributed correctly when it
    // comes from the innermost open level. Crossing levels is a programming error, and it fails
    // loudly rather than being silently counted against the inner scope.
    const outer = ErrorScope.begin();
    try {
      const inner = ErrorScope.begin();
      try {
        expect(() => outer.push(new Error('mis-attributed'))).toThrow(
          '[ErrorScope]: push() called at the wrong iteration depth.',
        );
      } finally {
        ErrorScope.end(inner);
      }
    } finally {
      ErrorScope.end(outer);
    }
  });

  test('sequential runs reuse the same frame', () => {
    const collect = (): IErrorScopeContext => {
      const context = ErrorScope.begin();
      try {
        return context;
      } finally {
        ErrorScope.end(context);
      }
    };

    // Nothing observable depends on this, but it is the whole point of pooling one frame per
    // depth: without it, every run would allocate, and the reuse tests above would pass
    // vacuously.
    expect(collect()).toBe(collect());

    // A run that throws still returns its frame, so the next one at that depth picks it up again.
    const first = collect();
    expect(() => {
      const context = ErrorScope.begin();
      try {
        context.push(new Error('boom'));
      } finally {
        ErrorScope.end(context);
      }
    }).toThrow('boom');
    expect(collect()).toBe(first);
  });

  test('a context used after its run has ended throws instead of writing somewhere else', () => {
    const leaked = ErrorScope.begin();
    ErrorScope.end(leaked);

    expect(() => leaked.push(new Error('late'))).toThrow('[ErrorScope]: context used outside its scope.');

    // The escaped write went nowhere, so the frame is still clean for its next legitimate run.
    let ran = 0;
    expect(() => {
      const context = ErrorScope.begin();
      try {
        ran++;
      } finally {
        ErrorScope.end(context);
      }
    }).not.toThrow();
    expect(ran).toBe(1);
  });

  test('a reported AggregateError is not hollowed out by the next run', () => {
    let caught: unknown;

    try {
      const context = ErrorScope.begin();
      try {
        context.push(new Error('a'));
        context.push(new Error('b'));
      } finally {
        ErrorScope.end(context);
      }
    } catch (e) {
      caught = e;
    }

    const errors = (caught as AggregateError).errors;
    expect(errors.map((e) => (e as Error).message)).toEqual(['a', 'b']);

    // The same frame runs again and reports again. `AggregateError` keeps the array it was given,
    // so the module has to start over with a fresh one rather than empty that array in place.
    expect(() => {
      const context = ErrorScope.begin();
      try {
        context.push(new Error('c'));
        context.push(new Error('d'));
      } finally {
        ErrorScope.end(context);
      }
    }).toThrow(AggregateError);

    expect((caught as AggregateError).errors).toBe(errors);
    expect(errors.map((e) => (e as Error).message)).toEqual(['a', 'b']);
  });

  test('end throws whatever was pushed before it was called', () => {
    const context = ErrorScope.begin();
    context.push(new Error('pushed before end'));

    expect(() => ErrorScope.end(context)).toThrow('pushed before end');
  });
});

/**
 * The same module through `using`. The scope shape is the whole subject of the tests above, and
 * `using` writes that shape for the caller: the disposal is the `end()`, and the block boundary is
 * the `finally`. What it does not do is behave identically when the block itself throws - that case
 * gets its own tests below, because it is the one place the two spellings diverge.
 */
describe('ErrorScope with using', () => {
  test('a scope with nothing to report throws nothing', () => {
    let ran = 0;

    expect(() => {
      using context = ErrorScope.begin();
      void context;
      ran++;
    }).not.toThrow();

    expect(ran).toBe(1);
  });

  test('a lone error surfaces at the end of the block', () => {
    const boom = new Error('boom');

    expect(() => {
      using context = ErrorScope.begin();
      context.push(boom);
    }).toThrow(boom);
  });

  test('a nested block that fails aborts the rest of its parent', () => {
    // The `using` spelling of the nesting test above, down to the ScopeAbortSignal that the inner
    // disposal throws: the parent catches it, push() drops it, and the error it stands for is
    // reported once by the outer level.
    //
    // The inner scope gets a block of its own, and that is not cosmetic: a `using` scope runs to
    // the end of the block it is declared in, so writing `using inner = ...` inline would move its
    // end() past the statements that follow and they would run before it could abort them.
    const trace: string[] = [];
    let caught: unknown;

    try {
      using outer = ErrorScope.begin();
      try {
        trace.push('before');

        {
          using inner = ErrorScope.begin();
          inner.push(new Error('inner boom'));
        }

        trace.push('after');
      } catch (e) {
        outer.push(e);
      }
    } catch (e) {
      caught = e;
    }

    expect(trace).toEqual(['before']);
    expect((caught as Error).message).toBe('inner boom');
    expect(caught).not.toBeInstanceOf(AggregateError);
  });

  test('two scopes in one block unwind in reverse, and the abort reaches the caller', () => {
    // `using` unwinds in reverse declaration order, which is the order end() requires - so a caller
    // cannot get the sequence wrong the way the misuse tests below describe. What they can get is
    // this: with both scopes in the same block there is no code between the two disposals to catch
    // the inner one's abort, so it leaves the block alongside the outer scope's report, and the
    // caller unwraps a SuppressedError to find the error they actually wanted. One scope per block
    // is the shape worth writing.
    let caught: unknown;

    try {
      using outer = ErrorScope.begin();
      using inner = ErrorScope.begin();

      void outer;
      inner.push(new Error('inner boom'));
    } catch (e) {
      caught = e;
    }

    expect(((caught as SuppressedError).error as Error).message).toBe('inner boom');
    expect((caught as SuppressedError).suppressed).toBe(ScopeAbortSignal.instance);
  });

  test('a block that throws on its own reaches the caller inside a SuppressedError', () => {
    // Where `using` and try/finally part company. A `finally { end(context) }` would throw the
    // scope's error and lose whatever the block threw; `using` hands the caller both, with the
    // disposal's error out front and the block's error suppressed behind it.
    let caught: unknown;

    try {
      using context = ErrorScope.begin();
      context.push(new Error('reported'));
      throw new Error('thrown');
    } catch (e) {
      caught = e;
    }

    expect((caught as SuppressedError).error).toBeInstanceOf(Error);
    expect(((caught as SuppressedError).error as Error).message).toBe('reported');
    expect(((caught as SuppressedError).suppressed as Error).message).toBe('thrown');
  });

  test('an inner block that both reports and throws is recorded once, unwrapped', () => {
    // The combination of the two tests above, and the reason push() unwraps: the inner disposal
    // throws ScopeAbortSignal, the block threw as well, so the parent's catch receives a
    // SuppressedError rather than the bare signal. Recording that wrapper would count the inner
    // error twice - once as itself, once inside the wrapper - and bury the block's own error.
    let caught: unknown;

    try {
      using outer = ErrorScope.begin();
      try {
        using inner = ErrorScope.begin();
        inner.push(new Error('inner boom'));
        throw new Error('body boom');
      } catch (e) {
        outer.push(e);
      }
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'inner boom',
      'body boom',
    ]);
  });
});

/**
 * Every misuse below deliberately corrupts module state, and the module is a singleton shared by
 * the whole file. Each of those tests ends with this, so a regression in the recovery paths
 * fails where it was caused instead of surfacing as a baffling failure in some later test.
 */
function expectHealthy(): void {
  expect(() => {
    const context = ErrorScope.begin();
    try {
      // nothing to report
    } finally {
      ErrorScope.end(context);
    }
  }).not.toThrow();

  expect(() => {
    const context = ErrorScope.begin();
    try {
      context.push(new Error('probe-flat'));
    } finally {
      ErrorScope.end(context);
    }
  }).toThrow('probe-flat');

  expect(() => {
    const outer = ErrorScope.begin();
    try {
      const inner = ErrorScope.begin();
      try {
        inner.push(new Error('probe-nested'));
      } finally {
        ErrorScope.end(inner);
      }
    } catch (e) {
      outer.push(e);
    } finally {
      ErrorScope.end(outer);
    }
  }).toThrow('probe-nested');
}

describe('ErrorScope misuse recovery', () => {
  // A scope is only well defined while its begin/end are balanced. None of these are supported
  // usage - they are what happens when a caller gets the try/finally wrong, and the point of
  // each test is that the module reports the mistake and then keeps working. Before this was
  // handled, a single slip left every later scope throwing a bare ScopeAbortSignal forever.

  test('an inner scope that is never ended is reclaimed by its parent', () => {
    let caught: unknown;

    const outer = ErrorScope.begin();
    try {
      outer.push(new Error('outer work failed'));
      ErrorScope.begin(); // depth 1, never ended - this is the mistake
    } finally {
      try {
        ErrorScope.end(outer);
      } catch (e) {
        caught = e;
      }
    }

    // The real error is still reported, with the misuse recorded alongside it.
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'outer work failed',
      '[ErrorScope]: end(context) called in the wrong sequence.',
    ]);
    expectHealthy();
  });

  test('end() given a foreign object still unwinds whatever is open', () => {
    // The common slip: the finally passes the wrong variable. end() cannot honour an argument
    // that designates no live scope, so it unwinds the innermost open one - which is exactly the
    // scope this caller meant. Returning instead would leave it open with nothing to close it.
    let caught: unknown;

    const context = ErrorScope.begin();
    try {
      context.push(new Error('real work failed'));
    } finally {
      try {
        ErrorScope.end({} as unknown as IErrorScopeContext);
      } catch (e) {
        caught = e;
      }
    }

    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'real work failed',
      '[ErrorScope]: end(context) called in the wrong sequence.',
    ]);
    expectHealthy();
  });

  test('end() given a closed frame from another depth behaves the same', () => {
    // Same shape as above, but the argument is a genuine frame rather than a foreign object -
    // it exercises the staleness half of the check instead of the instanceof half.
    let stale!: IErrorScopeContext;

    const warmup = ErrorScope.begin();
    try {
      stale = ErrorScope.begin();
      ErrorScope.end(stale);
    } finally {
      ErrorScope.end(warmup);
    }

    let caught: unknown;
    const context = ErrorScope.begin();
    try {
      context.push(new Error('real work failed'));
    } finally {
      try {
        ErrorScope.end(stale);
      } catch (e) {
        caught = e;
      }
    }

    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'real work failed',
      '[ErrorScope]: end(context) called in the wrong sequence.',
    ]);
    expectHealthy();
  });

  test('end() with no scope open reports the misuse instead of parking it', () => {
    // Nothing is open, so no scope could carry a report upwards. Throwing directly is what keeps
    // the errors array empty whenever the depth is fully unwound - park the misuse there instead
    // and it would attach itself to whichever batch fails next.
    const context = ErrorScope.begin();
    ErrorScope.end(context);

    expect(() => ErrorScope.end(context)).toThrow('[ErrorScope]: end(context) called while no scope was open.');
    expectHealthy();
  });

  test('a stale frame ended after its batch already reported is refused', () => {
    // The frame was reclaimed by its parent's end(), so by the time its own end() arrives there
    // is nothing left to close.
    const outer = ErrorScope.begin();
    outer.push(new Error('e1'));
    const inner = ErrorScope.begin();

    expect(() => ErrorScope.end(outer)).toThrow(AggregateError);
    expect(() => ErrorScope.end(inner)).toThrow('[ErrorScope]: end(context) called while no scope was open.');
    expectHealthy();
  });

  test('runaway nesting is stopped without leaking the depth', () => {
    // begin() commits currentDepth only after open() succeeds, so tripping the ceiling does not
    // leave the module one level deeper than it thinks - which would silence every later report.
    const recurse = (n: number): void => {
      const context = ErrorScope.begin();
      try {
        if (n > 0) recurse(n - 1);
      } finally {
        ErrorScope.end(context);
      }
    };

    expect(() => recurse(102)).toThrow(
      '[ErrorScope]: the current iteration depth exceeds the maximum iteration depth.',
    );
    expectHealthy();
  });
});
