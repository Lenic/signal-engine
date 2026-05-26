import { describe, expect, test } from 'vitest';
import { signal } from '../signal';
import { effect } from '../effect';
import { scheduler } from '../core';

describe('effect', () => {
  test('basic reactivity', () => {
    const s = signal(1);
    const list: number[] = [];

    effect(() => {
      list.push(s());
    });

    expect(list).toEqual([1]);

    s.set(2);
    expect(list).toEqual([1, 2]);

    s.set(3);
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

    s.set(2);
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
    a.set(2);
    expect(runCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Update inactive dependency 'b' - should not trigger
    b.set(20);
    expect(runCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Switch branch to false, which relies on 'b'
    flag.set(false);
    expect(runCount).toBe(3);
    expect(list).toEqual([1, 2, 20]);

    // Now 'a' is inactive, updating it should not trigger
    a.set(999);
    expect(runCount).toBe(3);
    expect(list).toEqual([1, 2, 20]);

    // Update newly active 'b' - should trigger
    b.set(30);
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
    a.set(2);
    expect(parentRunCount).toBe(2);
    // Since parent re-ran, it created a new child effect.
    // The old child effect is disposed (so it won't run). The new child runs.
    expect(childRunCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Now if we dispose the parent, all nested child effects should also be disposed.
    disposeParent();
    a.set(3);
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
      a.set(2);
    }).toThrow('Effect crash');

    expect(hasThrown).toBe(true);

    // Trigger normal effect update - it should still execute correctly since scheduler should recover
    b.set(20);
    expect(normalEffectRunCount).toBe(2);
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

    s.set(2);
    expect(runCount).toBe(2);

    // Should be disposed now, subsequent writes shouldn't trigger
    s.set(3);
    expect(runCount).toBe(2);
  });
});
