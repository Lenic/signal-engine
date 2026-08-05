import { describe, expect, test } from 'vitest';
import { signal } from '../signal';
import { effect } from '../effect';

describe('effect', () => {
  test('basic reactivity', () => {
    const s = signal(1);
    const list: number[] = [];

    effect(() => {
      list.push(s());
    });

    expect(list).toEqual([1]);

    s(2);
    expect(list).toEqual([1, 2]);

    s(3);
    expect(list).toEqual([1, 2, 3]);
  });

  test('dispose stops reactivity and cleans up', () => {
    const s = signal(1);
    const list: number[] = [];

    const dispose = effect(() => {
      list.push(s());
    });

    expect(list).toEqual([1]);

    dispose();

    s(2);
    expect(list).toEqual([1]);
  });

  test('dynamic dependency branch tracking', () => {
    const a = signal(1);
    const b = signal(10);
    const flag = signal(true);
    let runCount = 0;
    const list: number[] = [];

    effect(() => {
      runCount++;
      if (flag()) {
        list.push(a());
      } else {
        list.push(b());
      }
    });

    expect(runCount).toBe(1);
    expect(list).toEqual([1]);

    // Update active dependency 'a'
    a(2);
    expect(runCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Update inactive dependency 'b' - should not trigger
    b(20);
    expect(runCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Switch branch to false, which relies on 'b'
    flag(false);
    expect(runCount).toBe(3);
    expect(list).toEqual([1, 2, 20]);

    // Now 'a' is inactive, updating it should not trigger
    a(999);
    expect(runCount).toBe(3);
    expect(list).toEqual([1, 2, 20]);

    // Update newly active 'b' - should trigger
    b(30);
    expect(runCount).toBe(4);
    expect(list).toEqual([1, 2, 20, 30]);
  });

  test('nested effects disposal behavior', () => {
    const a = signal(1);
    let parentRunCount = 0;
    let childRunCount = 0;
    const list: number[] = [];

    const disposeParent = effect(() => {
      parentRunCount++;
      a();

      effect(() => {
        childRunCount++;
        list.push(a());
      });
    });

    expect(parentRunCount).toBe(1);
    expect(childRunCount).toBe(1);
    expect(list).toEqual([1]);

    // Trigger parent re-run.
    // The previous child effect should be auto-disposed when the parent re-runs.
    a(2);
    expect(parentRunCount).toBe(2);
    // Since parent re-ran, it created a new child effect.
    // The old child effect is disposed (so it won't run). The new child runs.
    expect(childRunCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Now if we dispose the parent, all nested child effects should also be disposed.
    disposeParent();
    a(3);
    expect(parentRunCount).toBe(2);
    expect(childRunCount).toBe(2);
    expect(list).toEqual([1, 2]);
  });

  test('error handling inside effect does not break scheduler', () => {
    const a = signal(1);
    const b = signal(10);
    let hasThrown = false;
    let normalEffectRunCount = 0;

    // Normal effect that should work
    effect(() => {
      normalEffectRunCount++;
      b();
    });

    // Failing effect
    effect(() => {
      if (a() === 2) {
        hasThrown = true;
        throw new Error('Effect crash');
      }
    });

    expect(normalEffectRunCount).toBe(1);
    expect(hasThrown).toBe(false);

    // Trigger update that causes an error
    expect(() => {
      a(2);
    }).toThrow('Effect crash');

    expect(hasThrown).toBe(true);

    // Trigger normal effect update - it should still execute correctly since scheduler should recover
    b(20);
    expect(normalEffectRunCount).toBe(2);
  });

  test('returned cleanup runs before each re-run and once on disposal', () => {
    const s = signal(1);
    const log: string[] = [];

    const dispose = effect(() => {
      const value = s();
      log.push(`run:${value}`);

      return () => log.push(`cleanup:${value}`);
    });

    expect(log).toEqual(['run:1']);

    // The previous run's cleanup fires first, then the new run.
    s(2);
    expect(log).toEqual(['run:1', 'cleanup:1', 'run:2']);

    s(3);
    expect(log).toEqual(['run:1', 'cleanup:1', 'run:2', 'cleanup:2', 'run:3']);

    dispose();
    expect(log).toEqual(['run:1', 'cleanup:1', 'run:2', 'cleanup:2', 'run:3', 'cleanup:3']);

    // Nothing left to trigger, and no further cleanup.
    s(4);
    expect(log).toEqual(['run:1', 'cleanup:1', 'run:2', 'cleanup:2', 'run:3', 'cleanup:3']);
  });

  test('a run that returns no cleanup leaves nothing behind', () => {
    const s = signal(1);
    let cleanupCount = 0;

    effect(() => {
      // Only the odd runs register a cleanup.
      if (s() % 2 === 1) {
        return () => void cleanupCount++;
      }
    });

    expect(cleanupCount).toBe(0);

    s(2); // releases run 1's cleanup, registers none
    expect(cleanupCount).toBe(1);

    s(3); // run 2 had no cleanup to release
    expect(cleanupCount).toBe(1);

    s(4); // releases run 3's cleanup
    expect(cleanupCount).toBe(2);
  });

  test('cleanup reads do not become dependencies', () => {
    const a = signal(1);
    const b = signal(100);
    let runCount = 0;

    effect(() => {
      runCount++;
      a();

      return () => void b();
    });

    expect(runCount).toBe(1);

    // `b` was only ever read by a cleanup, so it must not be a dependency.
    b(200);
    expect(runCount).toBe(1);

    a(2);
    expect(runCount).toBe(2);
  });

  test('cleanup is not double-invoked when it disposes its own effect', () => {
    const s = signal(1);
    let cleanupCount = 0;
    let dispose: (() => void) | undefined;

    dispose = effect(() => {
      s();

      return () => {
        cleanupCount++;
        dispose?.();
      };
    });

    s(2);
    expect(cleanupCount).toBe(1);

    // The effect disposed itself from within the cleanup, so nothing runs again.
    s(3);
    expect(cleanupCount).toBe(1);
  });

  test('disposing an effect during its own execution (self-dispose)', () => {
    const s = signal(1);
    let runCount = 0;

    const dispose = effect(() => {
      runCount++;
      s();
      if (runCount === 2) {
        dispose();
      }
    });

    expect(runCount).toBe(1);

    s(2);
    expect(runCount).toBe(2);

    // Should be disposed now, subsequent writes shouldn't trigger
    s(3);
    expect(runCount).toBe(2);
  });
});
