import { describe, expect, test } from 'vitest';
import { signal } from './signal';
import { effect } from './effect';
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
});
