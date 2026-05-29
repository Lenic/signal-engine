import { describe, expect, test } from 'vitest';
import { signal } from '../signal';
import { effect } from '../effect';
import { memo } from '../memo';

describe('memo', () => {
  test('basic computation', () => {
    const a = signal(1);
    const b = signal(2);

    let runCount = 0;
    const m = memo(() => {
      runCount++;
      return a() + b();
    });

    // Lazy: not run yet
    expect(runCount).toBe(0);

    expect(m()).toBe(3);
    expect(runCount).toBe(1);

    a(3);
    expect(m()).toBe(5);
    expect(runCount).toBe(2);
  });

  test('lazy evaluation and caching', () => {
    const a = signal(1);
    let runCount = 0;
    const m = memo(() => {
      runCount++;
      return a() * 10;
    });

    expect(runCount).toBe(0);

    // First read
    expect(m()).toBe(10);
    expect(runCount).toBe(1);

    // Second read - should return cached value
    expect(m()).toBe(10);
    expect(runCount).toBe(1);

    // Update dependency but don't read - should not compute
    a(2);
    expect(runCount).toBe(1);

    // Read after update - should recompute once
    expect(m()).toBe(20);
    expect(runCount).toBe(2);

    // Read again - should return cached
    expect(m()).toBe(20);
    expect(runCount).toBe(2);
  });

  test('nested memos (chained dependencies)', () => {
    const a = signal(2);
    let bRunCount = 0;
    let cRunCount = 0;

    const b = memo(() => {
      bRunCount++;
      return a() * 2; // 4
    });

    const c = memo(() => {
      cRunCount++;
      return b() + 5; // 9
    });

    expect(bRunCount).toBe(0);
    expect(cRunCount).toBe(0);

    expect(c()).toBe(9);
    expect(bRunCount).toBe(1);
    expect(cRunCount).toBe(1);

    a(3);
    // Values changed but not read
    expect(bRunCount).toBe(1);
    expect(cRunCount).toBe(1);

    expect(c()).toBe(11);
    expect(bRunCount).toBe(2);
    expect(cRunCount).toBe(2);
  });

  test('diamond dependency (glitch-free verification)', () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D (effect / read)
    const a = signal(1);

    let bCount = 0;
    const b = memo(() => {
      bCount++;
      return a() + 10;
    });

    let cCount = 0;
    const c = memo(() => {
      cCount++;
      return a() * 100;
    });

    let dCount = 0;
    const dList: number[] = [];
    effect(() => {
      dCount++;
      dList.push(b() + c());
    });

    // Initialization:
    // a = 1 -> b = 11, c = 100 -> b+c = 111
    expect(bCount).toBe(1);
    expect(cCount).toBe(1);
    expect(dCount).toBe(1);
    expect(dList).toEqual([111]);

    // Update A to 2:
    // a = 2 -> b = 12, c = 200 -> b+c = 212
    a(2);

    // Verify glitch-free: effect E must only run ONCE with the fully settled states of B and C.
    // There shouldn't be any intermediate/half-updated values like 12 + 100 (112) or 11 + 200 (211).
    expect(bCount).toBe(2);
    expect(cCount).toBe(2);
    expect(dCount).toBe(2);
    expect(dList).toEqual([111, 212]);
  });

  test('dynamic dependency tracking in memo', () => {
    const a = signal(1);
    const b = signal(2);
    const flag = signal(true);
    let runCount = 0;

    const m = memo(() => {
      runCount++;
      return flag() ? a() : b();
    });

    expect(m()).toBe(1);
    expect(runCount).toBe(1);

    // Modify inactive dependency 'b'
    b(100);
    // Since 'b' is not tracked, it shouldn't dirty the memo or trigger updates
    expect(m()).toBe(1);
    expect(runCount).toBe(1);

    // Toggle flag to false
    flag(false);
    expect(m()).toBe(100);
    expect(runCount).toBe(2);

    // Now 'a' is inactive, modify it
    a(99);
    expect(m()).toBe(100);
    expect(runCount).toBe(2);

    // Modify active 'b'
    b(200);
    expect(m()).toBe(200);
    expect(runCount).toBe(3);
  });

  test('memo disposal', () => {
    const a = signal(1);
    let runCount = 0;
    const m = memo(() => {
      runCount++;
      return a() * 2;
    });

    expect(m()).toBe(2);
    expect(runCount).toBe(1);

    m.dispose();

    a(2);
    // After disposal, dependency link is severed, it should just return the last cached value
    expect(m()).toBe(2);
    expect(runCount).toBe(1);
  });

  test('error propagation and recovery in memo', () => {
    const a = signal(1);
    const m = memo(() => {
      if (a() === 2) {
        throw new Error('Memo execution failed');
      }
      return a() * 2;
    });

    expect(m()).toBe(2);

    // Setting to invalid value causes evaluation failure
    a(2);
    expect(() => m()).toThrow('Memo execution failed');

    // Setting back to valid value allows recovery
    a(3);
    expect(m()).toBe(6);
  });

  test('unchanged computed values stop propagation to downstream', () => {
    const a = signal('a', { name: 'a' });
    const b = memo(
      () => {
        a();
        return 'b';
      },
      { name: 'b' },
    );
    const c = memo(
      () => {
        a();
        return 'c';
      },
      { name: 'c' },
    );

    let dCalls = 0;
    const d = memo(
      () => {
        dCalls++;
        return b() + ' ' + c();
      },
      { name: 'd' },
    );

    expect(d()).toBe('b c');
    dCalls = 0;

    debugger;
    a('aa');
    expect(d()).toBe('b c');
    expect(dCalls).toBe(0);
  });
});
