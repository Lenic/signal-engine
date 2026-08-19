import { describe, expect, test } from 'vitest';
import { signal } from '../signal';
import { effect } from '../effect';
import { memo } from '../memo';
import { globalScheduler } from '../core';

describe('batch', () => {
  test('basic batch updates', () => {
    const a = signal(1);
    const b = signal(2);
    let runCount = 0;
    const list: number[] = [];

    effect(() => {
      runCount++;
      list.push(a() + b());
    });

    expect(runCount).toBe(1);
    expect(list).toEqual([3]);

    globalScheduler.batch(() => {
      a(2);
      a(3);
      b(4);
    });

    // Should only trigger once at the end of the batch with final values
    expect(runCount).toBe(2);
    expect(list).toEqual([3, 7]);
  });

  test('nested batches', () => {
    const a = signal(1);
    const b = signal(2);
    let runCount = 0;
    const list: number[] = [];

    effect(() => {
      runCount++;
      list.push(a() + b());
    });

    expect(runCount).toBe(1);

    globalScheduler.batch(() => {
      globalScheduler.batch(() => {
        a(10);
        b(20);
      });
      // Outer batch not finished yet, shouldn't run
      expect(runCount).toBe(1);
      a(100);
    });

    expect(runCount).toBe(2);
    expect(list).toEqual([3, 120]);
  });

  test('no-op rollback in batch does not trigger update', () => {
    const a = signal(1);
    let runCount = 0;

    effect(() => {
      runCount++;
      a();
    });

    expect(runCount).toBe(1);

    globalScheduler.batch(() => {
      a(2);
      a(1); // Set back to original value before batch ends
    });

    // Since the end value is same as start value, it should NOT trigger updates
    expect(runCount).toBe(1);
  });

  test('disposing an effect inside batch prevents execution', () => {
    const a = signal(1);
    let runCount = 0;

    const dispose = effect(() => {
      runCount++;
      a();
    });

    expect(runCount).toBe(1);

    globalScheduler.batch(() => {
      a(2);
      dispose(); // Dispose before batch flushes
    });

    expect(runCount).toBe(1);
  });

  test('errors in batch do not lock scheduler', () => {
    const a = signal(1);
    const b = signal(10);
    let normalEffectRun = 0;

    effect(() => {
      normalEffectRun++;
      b();
    });

    effect(() => {
      if (a() === 2) {
        throw new Error('Batch effect crash');
      }
    });

    expect(normalEffectRun).toBe(1);

    expect(() => {
      globalScheduler.batch(() => {
        b(20);
        a(2); // Causes crash during flush
      });
    }).toThrow('Batch effect crash');

    // Make sure the normal effect was still updated during flush or scheduler recovered
    expect(normalEffectRun).toBe(2);

    // Verify scheduler works for future updates
    b(30);
    expect(normalEffectRun).toBe(3);
  });

  test('only execute once if memo value has not changed during batch', () => {
    const a = signal(2);
    const b = signal(3);
    const c = memo(() => a() + b());

    let runCount = 0;
    effect(() => {
      runCount++;
      c();
    });

    expect(runCount).toBe(1);

    globalScheduler.batch(() => {
      a(3);
      b(2);
      a(2);
      b(3);
    });

    expect(runCount).toBe(1);
  });
});
