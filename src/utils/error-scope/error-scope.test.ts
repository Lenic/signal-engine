import { describe, expect, test } from 'vitest';
import { ErrorScope } from './main';

describe('ErrorScope', () => {
  test('a run with nothing to report throws nothing', () => {
    let ran = 0;

    expect(() => ErrorScope.getInstance().run(() => void ran++)).not.toThrow();
    expect(ran).toBe(1);
  });

  test('a lone error surfaces unchanged rather than wrapped', () => {
    const boom = new Error('boom');

    expect(() =>
      ErrorScope.getInstance().run((context) => {
        context.capture(() => {
          throw boom;
        });
      }),
    ).toThrow(boom);
  });

  test('captured actions all run, and their errors are reported together', () => {
    const order: string[] = [];
    let caught: unknown;

    try {
      ErrorScope.getInstance().run((context) => {
        context.capture(() => {
          order.push('first');
          throw new Error('first failed');
        });
        context.capture(() => order.push('second'));
        context.capture(() => {
          order.push('third');
          throw new Error('third failed');
        });
      });
    } catch (e) {
      caught = e;
    }

    // The point of capturing: a failure does not stop the actions queued behind it.
    expect(order).toEqual(['first', 'second', 'third']);
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors.map((e) => (e as Error).message)).toEqual([
      'first failed',
      'third failed',
    ]);
  });

  test('finalize runs whether the callback succeeded or threw', () => {
    let finalized = 0;

    ErrorScope.getInstance().run(
      () => {},
      () => void finalized++,
    );
    expect(finalized).toBe(1);

    expect(() =>
      ErrorScope.getInstance().run(
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
      ErrorScope.getInstance().run(
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

  test('a reused instance never carries errors over into the next run', () => {
    // Instances are returned to a store and handed out again. A run that reports errors must
    // leave nothing behind for whoever picks that instance up next.
    for (let i = 0; i < 20; i++) {
      expect(() =>
        ErrorScope.getInstance().run((context) => {
          context.capture(() => {
            throw new Error('failure ' + i);
          });
        }),
      ).toThrow('failure ' + i);
    }

    let ran = 0;
    expect(() => ErrorScope.getInstance().run(() => void ran++)).not.toThrow();
    expect(ran).toBe(1);
  });

  test('nested runs keep their errors to themselves', () => {
    const seen: string[] = [];
    let outerCaught: unknown;

    try {
      ErrorScope.getInstance().run((outer) => {
        outer.capture(() => {
          // An inner scope reports on its own; the outer one only ever sees what escapes it.
          try {
            ErrorScope.getInstance().run((inner) => {
              inner.capture(() => {
                throw new Error('inner-a');
              });
              inner.capture(() => {
                throw new Error('inner-b');
              });
            });
          } catch (e) {
            seen.push((e as AggregateError).errors.map((x) => (x as Error).message).join('+'));
            throw new Error('inner rolled up');
          }
        });

        outer.capture(() => {
          throw new Error('outer-a');
        });
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

  test('an instance is never handed to two runs at once', () => {
    const active = new Set<unknown>();
    let overlaps = 0;

    const nest = (depth: number) => {
      const scope = ErrorScope.getInstance();

      scope.run(() => {
        if (active.has(scope)) overlaps++;
        active.add(scope);

        if (depth > 0) nest(depth - 1);

        active.delete(scope);
      });
    };

    for (let i = 0; i < 50; i++) nest(8);
    expect(overlaps).toBe(0);
  });
});
