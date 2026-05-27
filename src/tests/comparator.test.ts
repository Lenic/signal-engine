import { describe, expect, test } from 'vitest';
import { effect, setGlobalDeepComparator, signal } from '../index';

describe('setGlobalDeepComparator', () => {
  test('deep comparator prevents unnecessary updates', () => {
    const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    setGlobalDeepComparator(deepEqual);

    const obj = signal({ count: 1 }, { comparator: 'deep' });
    let runCount = 0;
    const dispose = effect(() => {
      runCount++;
      obj();
    });

    expect(runCount).toBe(1);

    obj({ count: 1 });
    expect(runCount).toBe(1);

    obj({ count: 2 });
    expect(runCount).toBe(2);

    dispose();
    obj({ count: 3 });
    expect(runCount).toBe(2);
  });
});
