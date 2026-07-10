import { describe, expect, test } from 'vitest';
import { signal } from '../signal';
import { effect } from '../effect';

describe('signal', () => {
  test('basic read and write', () => {
    const s = signal(1);
    expect(s()).toBe(1);

    s(2);
    expect(s()).toBe(2);

    s(3);
    expect(s()).toBe(3);
  });

  test('no trigger same value', () => {
    const count = signal(1);
    let runCount = 0;

    effect(() => {
      runCount++;
      count();
    });

    expect(runCount).toBe(1);

    // Set same value
    count(1);
    expect(runCount).toBe(1);
  });

  test('object references and mutations', () => {
    const initialObj = { value: 1 };
    const s = signal(initialObj);
    let runCount = 0;

    effect(() => {
      runCount++;
      s();
    });

    expect(runCount).toBe(1);

    // 1. Mutate internal property, keep same reference
    initialObj.value = 2;
    debugger;
    s(initialObj);
    // Reference check (value !== nextValue) means this shouldn't trigger update
    expect(runCount).toBe(1);
    expect(s().value).toBe(2);

    // 2. Set new object reference
    s({ value: 3 });
    expect(runCount).toBe(2);
    expect(s().value).toBe(3);
  });

  test('multiple subscribers tracking the same signal', () => {
    const s = signal('hello');
    let runCount1 = 0;
    let runCount2 = 0;

    effect(() => {
      runCount1++;
      s();
    });

    effect(() => {
      runCount2++;
      s();
    });

    expect(runCount1).toBe(1);
    expect(runCount2).toBe(1);

    s('world');
    expect(runCount1).toBe(2);
    expect(runCount2).toBe(2);
  });

  test('infinite loop detect in getter sync setter', () => {
    const count = signal(0);
    let caught = false;

    try {
      effect(() => {
        count(count() + 1);
      });
    } catch (e) {
      caught = true;
    }

    expect(caught).toBe(true);
  });
});
