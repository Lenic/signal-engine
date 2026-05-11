import { describe, expect, test } from 'vitest';
import { signal } from './signal';
import { effect } from './effect';

describe('Library Tests', () => {
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
  });
});
