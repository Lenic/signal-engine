import { describe, expect, test } from 'vitest';
import { globalScheduler } from '../core';
import { effect } from '../effect';
import { memo } from '../memo';
import { signal } from '../signal';

/**
 * Ownership: anything created while a ConnectorManager is executing belongs to that run.
 *
 * Two rules follow from it, and every test below pins down one corner of them:
 *   1. before an owner recomputes, the previous run's resources are released;
 *   2. when an owner is disposed, its resources are released with it.
 *
 * The single-level happy path lives in `effect.test.ts` ('nested effects disposal behavior');
 * this file covers the corners around it.
 */
describe('ownership', () => {
  test('cascades through three levels', () => {
    const a = signal(1);
    const counts = [0, 0, 0];

    const dispose = effect(() => {
      counts[0]++;
      a();
      effect(() => {
        counts[1]++;
        a();
        effect(() => {
          counts[2]++;
          a();
        });
      });
    });

    expect(counts).toEqual([1, 1, 1]);

    a(2);
    expect(counts).toEqual([2, 2, 2]);

    a(3);
    expect(counts).toEqual([3, 3, 3]);

    // Disposing the outermost effect must reach the grandchild, not just the child.
    dispose();
    a(4);
    expect(counts).toEqual([3, 3, 3]);
  });

  test('replaces a child that tracks a signal the parent does not', () => {
    const a = signal(1);
    const b = signal(10);
    let childRun = 0;
    const seen: number[] = [];

    effect(() => {
      a();
      effect(() => {
        childRun++;
        seen.push(b());
      });
    });

    expect(childRun).toBe(1);
    expect(seen).toEqual([10]);

    // 'b' is tracked by the child only, so only the child reruns.
    b(20);
    expect(childRun).toBe(2);
    expect(seen).toEqual([10, 20]);

    // 'a' is tracked by the parent, so the parent reruns: the old child is released
    // and a fresh one is created, which runs once on creation.
    a(2);
    expect(childRun).toBe(3);
    expect(seen).toEqual([10, 20, 20]);

    // The decisive assertion: the released child must no longer follow 'b'. If it were
    // still subscribed, this single write would bump childRun twice instead of once.
    b(30);
    expect(childRun).toBe(4);
    expect(seen).toEqual([10, 20, 20, 30]);
  });

  test('keeps its children when the owner does not recompute', () => {
    const a = signal(1);
    let parentRun = 0;
    let childRun = 0;

    effect(() => {
      parentRun++;
      a();
      effect(() => {
        childRun++;
        a();
      });
    });

    expect(parentRun).toBe(1);
    expect(childRun).toBe(1);

    // Writing an equal value is short-circuited by the comparer, so nothing recomputes -
    // and a run that never happens must not release anything.
    a(1);
    expect(parentRun).toBe(1);
    expect(childRun).toBe(1);
  });

  test('a memo owns the effects created while it computes', () => {
    const a = signal(1);
    let innerRun = 0;

    const m = memo(() => {
      a();
      effect(() => {
        innerRun++;
        a();
      });
      return a() * 2;
    });

    expect(m()).toBe(2);
    expect(innerRun).toBe(1);

    a(2);
    expect(m()).toBe(4);

    // An eager effect inside a lazy memo is an anti-pattern: the effect reacts to 'a' on
    // its own schedule *and* gets replaced when the memo finally recomputes, so the exact
    // run count is not a meaningful contract. The cascade is.
    const runsWhileAlive = innerRun;
    expect(runsWhileAlive).toBeGreaterThan(1);

    m.dispose();
    a(3);
    expect(innerRun).toBe(runsWhileAlive);
    a(4);
    expect(innerRun).toBe(runsWhileAlive);
  });

  test('a nested effect disposed right after creation runs exactly once', () => {
    const a = signal(1);
    let childRun = 0;

    effect(() => {
      a();
      const inner = effect(() => {
        childRun++;
        a();
      });
      // A nested effect runs immediately on creation - being created while the scheduler is
      // already running makes no difference - so disposing it here leaves exactly that one
      // run behind, and no subscription.
      inner();
    });

    expect(childRun).toBe(1);

    // The owner's rerun must not choke on releasing an already-disposed child, and the
    // disposed child must not have reacted to `a` on its own.
    expect(() => a(2)).not.toThrow();
    expect(childRun).toBe(2); // the owner re-ran and created a fresh child
  });

  test('a throwing cleanup still lets its siblings be released', () => {
    const a = signal(1);
    let goodChildRun = 0;
    let released = 0;

    effect(() => {
      a();

      // Reaching for the current manager is what `effect` itself does to find its owner.
      globalScheduler.connectorManager!.adopt(() => {
        released++;
        throw new Error('cleanup boom');
      });

      effect(() => {
        goodChildRun++;
        a();
      });
    });

    expect(goodChildRun).toBe(1);
    expect(released).toBe(0);

    // The cleanup error is reported rather than swallowed...
    expect(() => a(2)).toThrow('cleanup boom');
    expect(released).toBe(1);
    // ...but the sibling registered after it was released all the same, so the rerun
    // leaves exactly one live child - not two.
    expect(goodChildRun).toBe(2);

    // And the owner is still healthy on the next round.
    expect(() => a(3)).toThrow('cleanup boom');
    expect(released).toBe(2);
    expect(goodChildRun).toBe(3);
  });
});
