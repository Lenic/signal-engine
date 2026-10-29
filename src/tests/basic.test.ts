import { describe, expect, test } from 'vitest';

import { BatchScope } from '../base/batch-scope';
import { EffectAction } from '../base/effect-action';
import { MemoValue } from '../base/memo-value';
import { SignalValue } from '../base/signal-value';

describe('1. Signal: read, write and equality', () => {
  test('1.1 basic read and write', () => {
    const s = new SignalValue(1);
    expect(s.value).toBe(1);

    s.setValue(2);
    expect(s.value).toBe(2);

    s.setValue(3);
    expect(s.value).toBe(3);
  });

  test('1.2 the same object has not changed with custom comparer', () => {
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

  test('1.3 object references and mutations', () => {
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

describe('2. Effect: re-runs when what it read changes', () => {
  test('2.1 run when the dependency has been changed', () => {
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

  test('2.2 only the dependencies of the current branch trigger a re-run', () => {
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

describe('3. Memo: computed lazily and cached', () => {
  test('3.1 computes on the first read and recomputes after a change', () => {
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

  test('3.2 lazy evaluation and caching', () => {
    const a = new SignalValue(1);
    let runCount = 0;
    const m = new MemoValue(() => {
      runCount++;
      return a.value * 10;
    });

    expect(runCount).toBe(0);

    // First read
    expect(m.value).toBe(10);
    expect(runCount).toBe(1);

    // Second read - should return cached value
    expect(m.value).toBe(10);
    expect(runCount).toBe(1);

    // Update dependency but don't read - should not compute
    a.setValue(2);
    expect(runCount).toBe(1);

    // Read after update - should recompute once
    expect(m.value).toBe(20);
    expect(runCount).toBe(2);

    // Read again - should return cached
    expect(m.value).toBe(20);
    expect(runCount).toBe(2);
  });
});

describe('4. Propagation: memo chains and diamonds', () => {
  test('4.1 nested memos (chained dependencies)', () => {
    const a = new SignalValue(2);
    let bRunCount = 0;
    let cRunCount = 0;

    const b = new MemoValue(() => {
      bRunCount++;
      return a.value * 2; // 4
    });

    const c = new MemoValue(() => {
      cRunCount++;
      return b.value + 5; // 9
    });

    expect(bRunCount).toBe(0);
    expect(cRunCount).toBe(0);

    expect(c.value).toBe(9);
    expect(bRunCount).toBe(1);
    expect(cRunCount).toBe(1);

    a.setValue(3);
    // Values changed but not read
    expect(bRunCount).toBe(1);
    expect(cRunCount).toBe(1);

    expect(c.value).toBe(11);
    expect(bRunCount).toBe(2);
    expect(cRunCount).toBe(2);
  });

  test('4.2 diamond dependency (glitch-free verification)', () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D (effect / read)
    const a = new SignalValue(1, { name: 'a' });

    let bCount = 0;
    const b = new MemoValue(
      () => {
        bCount++;
        return a.value + 10;
      },
      { name: 'b' },
    );

    let cCount = 0;
    const c = new MemoValue(
      () => {
        cCount++;
        return a.value * 100;
      },
      { name: 'c' },
    );

    let dCount = 0;
    const dList: number[] = [];
    new EffectAction(
      () => {
        dCount++;
        dList.push(b.value + c.value);
      },
      { name: 'effect' },
    );

    // Initialization:
    // a = 1 -> b = 11, c = 100 -> b+c = 111
    expect(bCount).toBe(1);
    expect(cCount).toBe(1);
    expect(dCount).toBe(1);
    expect(dList).toEqual([111]);

    // Update A to 2:
    // a = 2 -> b = 12, c = 200 -> b+c = 212
    a.setValue(2);

    // Verify glitch-free: effect E must only run ONCE with the fully settled states of B and C.
    // There shouldn't be any intermediate/half-updated values like 12 + 100 (112) or 11 + 200 (211).
    expect(bCount).toBe(2);
    expect(cCount).toBe(2);
    expect(dCount).toBe(2);
    expect(dList).toEqual([111, 212]);
  });
});

describe('5. Dependency tracking: the same source read more than once', () => {
  const sourcesOf = (target: { connectors: EffectAction['connectors'] }) => {
    const sources: unknown[] = [];
    for (let node = target.connectors.head; node; node = node.next) {
      sources.push(node.value.instance);
    }
    return sources;
  };

  test('5.1 reading the same source repeatedly in one run subscribes only once', () => {
    const s = new SignalValue(1);
    let runCount = 0;

    const e = new EffectAction(() => {
      runCount++;
      void (s.value + s.value + s.value);
    });

    expect(runCount).toBe(1);
    expect(sourcesOf(e)).toEqual([s]);
    expect(s.listeners?.size).toBe(1);

    // a duplicated listener would not break the run count, so the shape must be checked as well
    s.setValue(2);
    expect(runCount).toBe(2);
    expect(sourcesOf(e)).toEqual([s]);
    expect(s.listeners?.size).toBe(1);
  });

  test('5.2 interleaved reads (a, b, a) keep the first position of each source', () => {
    const a = new SignalValue(1);
    const b = new SignalValue(10);
    const seen: number[] = [];

    const e = new EffectAction(() => {
      seen.push(a.value + b.value + a.value);
    });

    expect(seen).toEqual([12]);
    expect(sourcesOf(e)).toEqual([a, b]);
    expect(a.listeners?.size).toBe(1);
    expect(b.listeners?.size).toBe(1);

    a.setValue(2);
    expect(seen).toEqual([12, 14]);
    expect(sourcesOf(e)).toEqual([a, b]);
    expect(a.listeners?.size).toBe(1);
    expect(b.listeners?.size).toBe(1);

    b.setValue(20);
    expect(seen).toEqual([12, 14, 24]);
    expect(sourcesOf(e)).toEqual([a, b]);
  });

  test('5.3 a skipped duplicate must not advance the reused connector', () => {
    const a = new SignalValue(1);
    const b = new SignalValue(10);
    const c = new SignalValue(100);
    let runCount = 0;

    // if a skipped read moved `currentConnect` forward, the second run would overwrite `b` with `c`
    // or drop `c` in the tail cleanup
    const e = new EffectAction(() => {
      runCount++;
      void (a.value + a.value + b.value + c.value);
    });

    a.setValue(2);
    expect(runCount).toBe(2);
    expect(sourcesOf(e)).toEqual([a, b, c]);

    b.setValue(20);
    expect(runCount).toBe(3);

    c.setValue(200);
    expect(runCount).toBe(4);
    expect(sourcesOf(e)).toEqual([a, b, c]);
  });

  test('5.4 dedupe stays correct when the dependency order changes between runs', () => {
    const a = new SignalValue(1);
    const b = new SignalValue(10);
    const flag = new SignalValue(true);
    let runCount = 0;

    const e = new EffectAction(() => {
      runCount++;
      if (flag.value) {
        void (a.value + b.value + a.value);
      } else {
        void (b.value + a.value + b.value);
      }
    });

    expect(sourcesOf(e)).toEqual([flag, a, b]);

    flag.setValue(false);
    expect(runCount).toBe(2);
    expect(sourcesOf(e)).toEqual([flag, b, a]);
    expect(a.listeners?.size).toBe(1);
    expect(b.listeners?.size).toBe(1);

    a.setValue(2);
    expect(runCount).toBe(3);

    b.setValue(20);
    expect(runCount).toBe(4);
    expect(sourcesOf(e)).toEqual([flag, b, a]);
  });

  test('5.5 a new run tracks the latest version again instead of reusing the previous run stamp', () => {
    const s = new SignalValue(1);
    let runCount = 0;

    new EffectAction(() => {
      runCount++;
      void (s.value + s.value);
    });

    s.setValue(2);
    expect(runCount).toBe(2);

    // a stale version left from the first run would make every later run look changed (or unchanged)
    s.setValue(3);
    expect(runCount).toBe(3);

    s.setValue(3);
    expect(runCount).toBe(3);
  });

  test('5.6 different effects reading the same source are each subscribed', () => {
    const s = new SignalValue(1);
    let countA = 0;
    let countB = 0;

    new EffectAction(() => {
      countA++;
      void (s.value + s.value);
    });
    new EffectAction(() => {
      countB++;
      void (s.value + s.value);
    });

    expect(s.listeners?.size).toBe(2);

    s.setValue(2);
    expect(countA).toBe(2);
    expect(countB).toBe(2);
  });

  test('5.7 the duplicate read keeps the version observed by the first read', () => {
    const s = new SignalValue(1);
    const versionBeforeWrite = s.version;

    const m = new MemoValue(() => {
      const first = s.value;
      s.setValue(first + 1);
      return s.value;
    });

    expect(m.value).toBe(2);
    expect(sourcesOf(m)).toEqual([s]);
    expect(s.listeners?.size).toBe(1);

    // overwriting the snapshot with the post-write version would hide the self-invalidation
    expect(m.connectors.head!.value.version).toBe(versionBeforeWrite);
    expect(m.connectors.head!.value.version).not.toBe(s.version);
  });

  test('5.8 a nested run tracking the same source in between does not break the outer tracking', () => {
    const s = new SignalValue(1);
    const inner = new MemoValue(() => s.value * 10);
    const seen: number[] = [];

    // the outer run reads `s`, then `inner` re-tracks `s` with its own run stamp, then `s` again
    new EffectAction(() => {
      seen.push(s.value + inner.value + s.value);
    });

    expect(seen).toEqual([12]);
    expect(sourcesOf(inner)).toEqual([s]);

    s.setValue(2);
    expect(seen).toEqual([12, 24]);

    s.setValue(3);
    expect(seen).toEqual([12, 24, 36]);
    expect(sourcesOf(inner)).toEqual([s]);
  });
});

describe('6. Dispose: stop reacting and release dependencies', () => {
  test('6.1 a disposed effect no longer runs', () => {
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

  test('6.2 nested effects disposal behavior', () => {
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

  test('6.3 memo disposal', () => {
    const a = new SignalValue(1);
    let runCount = 0;
    const m = new MemoValue(() => {
      runCount++;
      return a.value * 2;
    });

    expect(m.value).toBe(2);
    expect(runCount).toBe(1);

    m.dispose();
    a.setValue(2);

    // After disposal, dependency link is severed, it should just return the last cached value
    expect(m.value).toBe(2);
    expect(runCount).toBe(1);
  });
});

describe('7. Batch: grouped writes', () => {
  test('7.1 several writes in a batch are computed only once', () => {
    const a = new SignalValue(1);

    let runCount = 0;
    const m = new MemoValue(() => {
      runCount++;
      return a.value * 10;
    });

    const level = BatchScope.begin();
    try {
      a.setValue(2);
      a.setValue(3);
    } finally {
      BatchScope.end(level);
    }

    expect(m.value).toBe(30);
    expect(runCount).toBe(1);
  });

  test('7.2 a version restored by the batch rollback must not be reused by a later write', () => {
    const a = new SignalValue(1);

    let runCount = 0;
    const m = new MemoValue(() => {
      runCount++;
      return a.value * 10;
    });

    expect(m.value).toBe(10);
    expect(runCount).toBe(1);

    const level = BatchScope.begin();
    try {
      a.setValue(2);
      expect(m.value).toBe(20);
      expect(runCount).toBe(2);

      a.setValue(1);
    } finally {
      BatchScope.end(level);
    }

    a.setValue(3);
    expect(runCount).toBe(2);

    expect(m.value).toBe(30);
    expect(runCount).toBe(3);
  });

  test('7.3 a write after the batch rollback must still notify the effect', () => {
    const a = new SignalValue(1);

    const seen: number[] = [];
    new EffectAction(() => {
      seen.push(a.value);
    });

    const level = BatchScope.begin();
    try {
      a.setValue(2);
      a.setValue(1);
    } finally {
      BatchScope.end(level);
    }

    // the rollback restores the version, so the queued effect is skipped
    expect(seen).toEqual([1]);

    // the skipped effect never reads `a` again, so `a` must not stay marked as unread
    a.setValue(3);
    expect(seen).toEqual([1, 3]);
  });

  test('7.4 a write after the batch rollback must still reach the effect through a memo', () => {
    const a = new SignalValue(1);
    const m = new MemoValue(() => a.value * 10);

    const seen: number[] = [];
    new EffectAction(() => {
      seen.push(m.value);
    });

    const level = BatchScope.begin();
    try {
      a.setValue(2);
      a.setValue(1);
    } finally {
      BatchScope.end(level);
    }

    expect(seen).toEqual([10]);

    // restoring the read mark of `a` alone is not enough: `m` was marked dirty in the batch
    // and only its version is checked afterwards, so `m` must not stay marked as unread either
    a.setValue(3);
    expect(seen).toEqual([10, 30]);
  });
});

describe('8. Depth: long dependency chains', () => {
  // Nothing in the graph caps its depth; only the call stack does. Each level used to open its
  // own error scope, which made the scope's iteration ceiling a hidden limit of about 100 memos.
  const DEPTH = 300;

  function buildChain(source: SignalValue<number>) {
    let node: { readonly value: number } = source;
    for (let i = 0; i < DEPTH; i++) {
      const prev = node;
      node = new MemoValue(() => prev.value + 1);
    }
    return node;
  }

  test('8.1 a long chain computes on its first read', () => {
    const s = new SignalValue(0);
    expect(buildChain(s).value).toBe(DEPTH);
  });

  test('8.2 a write propagates down a long chain to an effect', () => {
    const s = new SignalValue(0);
    const tail = buildChain(s);

    const seen: number[] = [];
    new EffectAction(() => {
      seen.push(tail.value);
    });

    s.setValue(1);
    s.setValue(2);
    expect(seen).toEqual([DEPTH, DEPTH + 1, DEPTH + 2]);
  });

  test('8.3 an error at the top of a long chain reaches the writer', () => {
    const s = new SignalValue(0);
    const head = new MemoValue(() => {
      if (s.value === 1) throw new Error('head failed');
      return s.value;
    });
    let node: { readonly value: number } = head;
    for (let i = 0; i < DEPTH; i++) {
      const prev = node;
      node = new MemoValue(() => prev.value + 1);
    }
    const tail = node;

    new EffectAction(() => {
      void tail.value;
    });

    expect(() => s.setValue(1)).toThrow('head failed');

    // the graph is still usable afterwards
    const seen: number[] = [];
    new EffectAction(() => {
      seen.push(tail.value);
    });
    s.setValue(2);
    expect(seen.at(-1)).toBe(DEPTH + 2);
  });
});

// describe('TestSuite', () => {});
