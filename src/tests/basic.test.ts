import { describe, expect, test } from 'vitest';

import { EffectAction } from '../base/effect-action';
import { SignalValue } from '../base/signal-value';

describe('SignalValue', () => {
  test('basic read and write', () => {
    const s = new SignalValue(1);
    expect(s.value).toBe(1);

    s.setValue(2);
    expect(s.value).toBe(2);

    s.setValue(3);
    expect(s.value).toBe(3);
  });
});

describe('SignalValue & EffectAction', () => {
  test('run when the dependency has been changed', () => {
    const count = new SignalValue(1);
    let runCount = 0;

    new EffectAction(() => {
      runCount++;
      count.value.toString();
    });

    expect(runCount).toBe(1);

    count.setValue(2);
    expect(runCount).toBe(2);
  });

  test('dynamic dependency branch tracking', () => {
    const a = new SignalValue(1);
    const b = new SignalValue(10);
    const flag = new SignalValue(true);
    let runCount = 0;
    const list: number[] = [];

    new EffectAction(() => {
      runCount++;
      if (flag.value) {
        list.push(a.value);
      } else {
        list.push(b.value);
      }
    });

    expect(runCount).toBe(1);
    expect(list).toEqual([1]);

    // Update active dependency 'a'
    a.setValue(2);
    expect(runCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Update inactive dependency 'b' - should not trigger
    b.setValue(20);
    expect(runCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Switch branch to false, which relies on 'b'
    flag.setValue(false);
    expect(runCount).toBe(3);
    expect(list).toEqual([1, 2, 20]);

    // Now 'a' is inactive, updating it should not trigger
    a.setValue(999);
    expect(runCount).toBe(3);
    expect(list).toEqual([1, 2, 20]);

    // Update newly active 'b' - should trigger
    b.setValue(30);
    expect(runCount).toBe(4);
    expect(list).toEqual([1, 2, 20, 30]);
  });
});
