import { describe, expect, test } from 'vitest';
import { signal } from './signal';
import { effect } from './effect';
import { memo } from './memo';
import { scheduler } from '../core';

describe('Library', () => {
  describe('signal', () => {
    test('basic', () => {
      const s = signal(1);
      expect(s()).toBe(1);

      s.set(2);
      expect(s()).toBe(2);

      s.set(2);
      expect(s()).toBe(2);
    });

    test('no trigger same value', () => {
      const count = signal(1);
      let runCount = 0;

      effect(() => {
        runCount++;
      });

      count.set(1);

      expect(runCount).toBe(1);
    });

    test('batched updates', () => {
      const count = signal(1);

      let runCount = 0;
      const list: number[] = [];
      effect(() => {
        runCount++;
        list.push(count());
      });

      scheduler.batch(() => {
        count.set(2);
        count.set(3);
        count.set(4);
      });

      expect(runCount).toBe(2);
      expect(list).toEqual([1, 4]);
      expect(count()).toBe(4);
    });

    test('infinite loop detect', () => {
      const count = signal(0);
      let caught = false;

      try {
        effect(() => {
          count.set(count() + 1);
        });
      } catch (e) {
        caught = true;
      }

      expect(caught).toBe(true);
    });
  });

  describe('effect', () => {
    test('basic', () => {
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

    test('dispose', () => {
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

    test('dynamic dependency', () => {
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

      flag.set(false);
      b.set(20);
      a.set(999);

      expect(runCount).toBe(3);
      expect(list).toEqual([1, 10, 20]);
    });

    test('nested effect', () => {
      const a = signal(1);
      let runCount = 0;

      const list: number[] = [];
      effect(() => {
        runCount++;
        list.push(a());

        effect(() => {
          runCount++;
          list.push(a());
        });
      });

      a.set(2);

      expect(runCount).toBe(4);
      expect(list).toEqual([1, 1, 2, 2]);
    });

    test('nested effect with dispose', () => {
      const a = signal(1);
      let runCount = 0;

      const list: number[] = [];
      let childDispose: (() => void) | undefined;
      const parentDispose = effect(() => {
        runCount++;
        list.push(a());

        childDispose = effect(() => {
          runCount++;
          list.push(a());
        });
      });

      expect(runCount).toBe(2);
      expect(list).toEqual([1, 1]);

      a.set(2);

      expect(runCount).toBe(4);
      expect(list).toEqual([1, 1, 2, 2]);

      childDispose?.();
      a.set(3);
      expect(runCount).toBe(6);
      expect(list).toEqual([1, 1, 2, 2, 3, 3]);

      parentDispose();
      a.set(4);

      expect(runCount).toBe(6);
      expect(list).toEqual([1, 1, 2, 2, 3, 3]);
    });

    test('multiple effects on same signal', () => {
      const a = signal(1);
      let runCount = 0;

      const list: number[] = [];
      effect(() => {
        runCount++;
        list.push(a());
      });

      const list2: number[] = [];
      effect(() => {
        runCount++;
        list2.push(a());
      });

      a.set(2);

      expect(runCount).toBe(4);
      expect(list).toEqual([1, 2]);
      expect(list2).toEqual([1, 2]);
    });
  });

  describe('memo', () => {
    test('basic', () => {
      const a = signal(1);
      const b = signal(2);

      let runCount = 0;
      const m = memo(() => {
        runCount += 1;
        return a() + b();
      });

      expect(m()).toBe(3);
      expect(runCount).toBe(1);

      a.set(2);
      expect(m()).toBe(4);
      expect(runCount).toBe(2);
    });

    test('lazy evaluation', () => {
      const a = signal(1);
      let runCount = 0;
      const m = memo(() => {
        runCount += 1;
        return a() * 2;
      });

      // Not read yet, should not run
      expect(runCount).toBe(0);

      // Read once
      expect(m()).toBe(2);
      expect(runCount).toBe(1);

      // Read again, should not run again
      expect(m()).toBe(2);
      expect(runCount).toBe(1);

      // Dependency changes, but memo is not read, should not run
      a.set(2);
      expect(runCount).toBe(1);

      // Read after dependency change
      expect(m()).toBe(4);
      expect(runCount).toBe(2);
    });

    test('dispose', () => {
      const a = signal(1);
      let runCount = 0;
      const m = memo(() => {
        runCount += 1;
        return a() * 2;
      });

      expect(m()).toBe(2);
      expect(runCount).toBe(1);

      m.dispose();
      a.set(2);
      expect(m()).toBe(2);
      expect(runCount).toBe(1);
    });

    test('with effect', () => {
      const a = signal(1);
      let memoRunCount = 0;
      const m = memo(() => {
        memoRunCount++;
        return a() * 2;
      });

      let effectRunCount = 0;
      const list: number[] = [];
      effect(() => {
        effectRunCount++;
        list.push(m());
      });

      expect(memoRunCount).toBe(1);
      expect(effectRunCount).toBe(1);
      expect(list).toEqual([2]);

      a.set(2);
      expect(memoRunCount).toBe(2);
      expect(effectRunCount).toBe(2);
      expect(list).toEqual([2, 4]);
    });

    test('dynamic dependency', () => {
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

      // Change unused dependency
      b.set(3);
      // It shouldn't trigger re-evaluation because b is not tracked
      expect(m()).toBe(1);
      expect(runCount).toBe(1);

      // Change flag
      flag.set(false);
      expect(m()).toBe(3);
      expect(runCount).toBe(2);

      // Change newly used dependency
      b.set(4);
      expect(m()).toBe(4);
      expect(runCount).toBe(3);

      // Change previously used dependency
      a.set(99);
      expect(m()).toBe(4);
      expect(runCount).toBe(3);
    });

    test('diamond dependency (glitch)', () => {
      const s = signal(1);

      let runCount1 = 0;
      const m1 = memo(() => {
        runCount1 += 1;
        return s() + 1;
      });

      let runCount2 = 0;
      const m2 = memo(() => {
        runCount2 += 1;
        return s() + 2;
      });

      let effectRunCount = 0;
      let sum = 0;
      effect(() => {
        effectRunCount++;
        sum = m1() + m2();
      });

      expect(sum).toBe(5);
      expect(runCount1).toBe(1);
      expect(runCount2).toBe(1);
      expect(effectRunCount).toBe(1);

      s.set(10);
      expect(runCount1).toBe(2);
      expect(runCount2).toBe(2);
      expect(effectRunCount).toBe(2);
      expect(sum).toBe(23);
    });
  });

  describe('batch', () => {
    test('basic', () => {
      const a = signal(1);
      const b = signal(2);

      let effectRunCount = 0;
      const list: number[] = [];
      effect(() => {
        effectRunCount++;
        list.push(a() + b());
      });

      expect(list).toEqual([3]);
      expect(effectRunCount).toBe(1);

      scheduler.batch(() => {
        a.set(2);
        b.set(3);
      });

      expect(list).toEqual([3, 5]);
      expect(effectRunCount).toBe(2);
    });

    test('nested batch', () => {
      const a = signal(1);
      const b = signal(2);

      let effectRunCount = 0;
      const list: number[] = [];
      effect(() => {
        effectRunCount++;
        list.push(a() + b());
      });

      expect(list).toEqual([3]);
      expect(effectRunCount).toBe(1);

      scheduler.batch(() => {
        scheduler.batch(() => {
          a.set(2);
          b.set(3);
        });
        b.set(4);
      });

      expect(list).toEqual([3, 6]);
      expect(effectRunCount).toBe(2);
    });

    test('with dispose', () => {
      const a = signal(1);
      const b = signal(2);

      let effectRunCount = 0;
      const list: number[] = [];
      const dispose = effect(() => {
        effectRunCount++;
        list.push(a() + b());
      });

      expect(list).toEqual([3]);
      expect(effectRunCount).toBe(1);

      dispose();
      scheduler.batch(() => {
        a.set(2);
        b.set(3);
      });

      expect(list).toEqual([3]);
      expect(effectRunCount).toBe(1);
    });

    test('with memo', () => {
      const a = signal(1);
      const b = signal(2);

      let memoRunCount = 0;
      const m = memo(() => {
        memoRunCount++;
        return a() + b();
      });

      expect(m()).toBe(3);
      expect(memoRunCount).toBe(1);

      let effectRunCount = 0;
      const list: number[] = [];
      effect(() => {
        effectRunCount++;
        list.push(m());
      });

      expect(list).toEqual([3]);
      expect(effectRunCount).toBe(1);
      expect(memoRunCount).toBe(1);

      scheduler.batch(() => {
        a.set(2);
        b.set(3);
      });

      expect(list).toEqual([3, 5]);
      expect(effectRunCount).toBe(2);
      expect(memoRunCount).toBe(2);
    });
  });
});
