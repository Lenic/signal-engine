import { describe, expect, test } from 'vitest';
import { signal } from './signal';
import { effect } from './effect';

describe('Library Tests', () => {
  test('signal()', () => {
    const s = signal(1);
    expect(s()).toBe(1);

    s.set(2);
    expect(s()).toBe(2);

    s.set(2);
    expect(s()).toBe(2);
  });

  test('effect()', () => {
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

  test('effect() - dispose', () => {
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
});
