import { describe, expect, test } from 'vitest';

import { EffectAction } from '../base/effect-action';
import { MemoValue } from '../base/memo-value';
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

  test('the same object has not changed with custom comparer', () => {
    const initialObj = { value: 1, label: 'default' };
    const s = new SignalValue(initialObj, { comparer: (x, y) => x.label === y.label });
    let runCount = 0;

    new EffectAction(() => {
      runCount++;
      void s.value;
    });

    expect(runCount).toBe(1);

    // set a new object but get the equal result by the custom comparer
    s.setValue({ value: 2, label: 'default' });
    expect(runCount).toBe(1);
    expect(s.value.value).toBe(1);
  });

  test('object references and mutations', () => {
    const initialObj = { value: 1 };
    const s = new SignalValue(initialObj);
    let runCount = 0;

    new EffectAction(() => {
      runCount++;
      void s.value;
    });

    expect(runCount).toBe(1);

    // 1. Mutate internal property, keep same reference
    initialObj.value = 2;
    s.setValue(initialObj);
    // Reference check (value !== nextValue) means this shouldn't trigger update
    expect(runCount).toBe(1);
    expect(s.value.value).toBe(2);

    // 2. Set new object reference
    s.setValue({ value: 3 });
    expect(runCount).toBe(2);
    expect(s.value.value).toBe(3);
  });

  test('dispose stops reactivity and cleans up', () => {
    const s = new SignalValue(1);
    const list: number[] = [];

    const ea = new EffectAction(() => {
      list.push(s.value);
    });

    expect(list).toEqual([1]);

    ea.dispose();

    s.setValue(2);
    expect(list).toEqual([1]);
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

  test('nested effects disposal behavior', () => {
    const a = new SignalValue(1);
    let parentRunCount = 0;
    let childRunCount = 0;
    const list: number[] = [];

    const parent = new EffectAction(() => {
      parentRunCount++;
      void a.value;

      new EffectAction(() => {
        childRunCount++;
        list.push(a.value);
      });
    });

    expect(parentRunCount).toBe(1);
    expect(childRunCount).toBe(1);
    expect(list).toEqual([1]);

    // Trigger parent re-run.
    // The previous child effect should be auto-disposed when the parent re-runs.
    a.setValue(2);
    expect(parentRunCount).toBe(2);
    // Since parent re-ran, it created a new child effect.
    // The old child effect is disposed (so it won't run). The new child runs.
    expect(childRunCount).toBe(2);
    expect(list).toEqual([1, 2]);

    // Now if we dispose the parent, all nested child effects should also be disposed.
    parent.dispose();
    a.setValue(3);
    expect(parentRunCount).toBe(2);
    expect(childRunCount).toBe(2);
    expect(list).toEqual([1, 2]);
  });
});

describe('SignalValue & MemoValue', () => {
  test('baseic read and write', () => {
    const s = new SignalValue(1);
    let runCount = 0;
    const m = new MemoValue(() => {
      runCount += 1;
      return s.value + 1;
    });

    expect(runCount).toBe(0);
    expect(m.value).toBe(2);
    expect(runCount).toBe(1);

    s.setValue(2);
    expect(runCount).toBe(1);
    expect(m.value).toBe(3);
    expect(runCount).toBe(2);
  });

  // test('the same object has not changed with custom comparer', () => {
  //   const initialObj = { value: 1, label: 'default' };
  //   const s = new SignalValue(initialObj);
  //   let runCount = 0;
  //
  //   new EffectAction(() => {
  //     runCount++;
  //     void s.value;
  //   });
  //
  //   expect(runCount).toBe(1);
  //
  //   // set a new object but get the equal result by the custom comparer
  //   s.setValue({ value: 2, label: 'default' });
  //   expect(runCount).toBe(1);
  //   expect(s.value.value).toBe(1);
  // });
});
