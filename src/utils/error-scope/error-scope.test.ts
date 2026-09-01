import { describe, expect, test } from 'vitest';
import { ErrorScope } from './main';
import type { IErrorScopeContext } from './types';

/**
 * `ErrorScope` only exposes `begin`/`end` now - every production caller wraps its own work in a
 * `try`/`finally` around them instead of handing a closure to a fused `run(callback, finalize)`.
 * This test-only helper restores that shape purely so the tests below stay readable, without
 * reintroducing `run` into the library itself.
 */
function runScope(callback: (context: IErrorScopeContext) => void, finalize?: () => void): void {
  const context = ErrorScope.begin();
  try {
    try {
      callback(context);
    } catch (e) {
      context.push(e);
    }

    if (finalize) {
      try {
        finalize();
      } catch (e) {
        context.push(e);
      }
    }
  } finally {
    ErrorScope.end(context);
  }
}

describe('ErrorScope', () => {
  test('a scope with nothing to report throws nothing', () => {
    let ran = 0;

    expect(() => runScope(() => void ran++)).not.toThrow();
    expect(ran).toBe(1);
  });

  test('a lone error surfaces unchanged rather than wrapped', () => {
    const boom = new Error('boom');

    expect(() =>
      runScope((context) => {
        try {
          throw boom;
        } catch (e) {
          context.push(e);
        }
      }),
    ).toThrow(boom);
  });

  test('errors from separate steps are all reported together', () => {
    const order: string[] = [];
    let caught: unknown;

    try {
      runScope((context) => {
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
      });
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

  test('finalize runs whether the callback succeeded or threw', () => {
    let finalized = 0;

    runScope(
      () => {},
      () => void finalized++,
    );
    expect(finalized).toBe(1);

    expect(() =>
      runScope(
        () => {
          throw new Error('callback failed');
        },
        () => void finalized++,
      ),
    ).toThrow('callback failed');
    expect(finalized).toBe(2);
  });

  test('a failing finalize is reported alongside the original error', () => {
    let caught: unknown;

    try {
      runScope(
        () => {
          throw new Error('callback failed');
        },
        () => {
          throw new Error('finalize failed');
        },
      );
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'callback failed',
      'finalize failed',
    ]);
  });

  test('a reused scope never carries errors over into the next run', () => {
    // Scopes are pooled and handed out again. A run that reports errors must leave nothing behind
    // for whoever picks that scope up next.
    for (let i = 0; i < 20; i++) {
      expect(() =>
        runScope((context) => {
          try {
            throw new Error('failure ' + i);
          } catch (e) {
            context.push(e);
          }
        }),
      ).toThrow('failure ' + i);
    }

    let ran = 0;
    expect(() => runScope(() => void ran++)).not.toThrow();
    expect(ran).toBe(1);
  });

  test('nested runs keep their errors to themselves', () => {
    const seen: string[] = [];
    let outerCaught: unknown;

    try {
      runScope((outer) => {
        // An inner scope reports on its own; the outer one only ever sees what escapes it.
        try {
          try {
            runScope((inner) => {
              try {
                throw new Error('inner-a');
              } catch (e) {
                inner.push(e);
              }
              try {
                throw new Error('inner-b');
              } catch (e) {
                inner.push(e);
              }
            });
          } catch (e) {
            seen.push((e as AggregateError).errors.map((x) => (x as Error).message).join('+'));
            throw new Error('inner rolled up');
          }
        } catch (e) {
          outer.push(e);
        }

        try {
          throw new Error('outer-a');
        } catch (e) {
          outer.push(e);
        }
      });
    } catch (e) {
      outerCaught = e;
    }

    expect(seen).toEqual(['inner-a+inner-b']);
    expect((outerCaught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'inner rolled up',
      'outer-a',
    ]);
  });

  test('a scope is never handed to two runs at once', () => {
    const nest = (depth: number, live: Set<IErrorScopeContext>) => {
      runScope((context) => {
        // Reuse is by nesting depth, so an outer run's scope must never be the one an inner run
        // is given - that is the aliasing a pool has to rule out.
        expect(live.has(context)).toBe(false);
        live.add(context);

        if (depth > 0) nest(depth - 1, live);

        live.delete(context);
      });
    };

    for (let i = 0; i < 50; i++) nest(8, new Set());
  });

  test('runs at the same depth reuse the same scope', () => {
    const collect = () => {
      let seen: IErrorScopeContext | undefined;
      runScope((context) => void (seen = context));
      return seen;
    };

    // Nothing observable depends on this, but it is the whole point of pooling: without it every
    // run allocates, and the reuse tests above would pass vacuously.
    expect(collect()).toBe(collect());

    // A run that throws still returns its scope, so the next one at that depth picks it up again.
    const first = collect();
    expect(() =>
      runScope(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(collect()).toBe(first);
  });

  test('a context used after its run has ended throws instead of writing somewhere else', () => {
    let leaked: IErrorScopeContext | undefined;

    runScope((context) => void (leaked = context));

    expect(() => leaked!.push(new Error('late'))).toThrow('[ErrorScope]: context used outside its scope.');

    // The escaped write went nowhere, so the scope is still clean for its next legitimate run.
    let ran = 0;
    expect(() => runScope(() => void ran++)).not.toThrow();
    expect(ran).toBe(1);
  });

  test('a reported AggregateError is not hollowed out by the next run', () => {
    let caught: unknown;

    try {
      runScope((context) => {
        try {
          throw new Error('a');
        } catch (e) {
          context.push(e);
        }
        try {
          throw new Error('b');
        } catch (e) {
          context.push(e);
        }
      });
    } catch (e) {
      caught = e;
    }

    const errors = (caught as AggregateError).errors;
    expect(errors.map((e) => (e as Error).message)).toEqual(['a', 'b']);

    // The same scope runs again and reports again. `AggregateError` keeps the array it was given,
    // so the scope has to start over with a fresh one rather than empty that array in place.
    expect(() =>
      runScope((context) => {
        try {
          throw new Error('c');
        } catch (e) {
          context.push(e);
        }
        try {
          throw new Error('d');
        } catch (e) {
          context.push(e);
        }
      }),
    ).toThrow(AggregateError);

    expect((caught as AggregateError).errors).toBe(errors);
    expect(errors.map((e) => (e as Error).message)).toEqual(['a', 'b']);
  });

  test('begin/end pairs correctly without a callback wrapper', () => {
    // The production shape: no closure around the work at all, just a plain try/finally.
    const context = ErrorScope.begin();
    let ran = false;
    try {
      ran = true;
    } finally {
      ErrorScope.end(context);
    }
    expect(ran).toBe(true);
  });

  test('end throws whatever was pushed before it was called', () => {
    const context = ErrorScope.begin();
    context.push(new Error('pushed before end'));

    expect(() => ErrorScope.end(context)).toThrow('pushed before end');
  });
});
