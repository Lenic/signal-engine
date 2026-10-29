import type { ReactiveFramework } from 'reactive-framework-test-suite';

import { testSuite, SkipTest, setExpect } from 'reactive-framework-test-suite';
import { describe, expect, test } from 'vitest';

import { BatchScope } from '../base/batch';
import { EffectAction } from '../base/effect';
import { globalContext } from '../base/context';
import { MemoValue } from '../base/memo';
import { SignalValue } from '../base/signal';

const framework: ReactiveFramework = {
  signal(initialValue) {
    const s = new SignalValue(initialValue);
    return {
      read: () => s.value,
      write: (v) => s.setValue(v),
    };
  },
  computed(fn) {
    const c = new MemoValue(fn);
    return { read: () => c.value };
  },
  effect(fn) {
    const instance = new EffectAction(fn);
    return () => instance.dispose();
  },
  run(fn) {
    fn();
  },
  batch(fn) {
    // `#176 batch return value` checks that the callback's return value is forwarded.
    let result: unknown;
    const level = BatchScope.begin();
    try {
      result = fn();
    } finally {
      BatchScope.end(level);
    }
    return result as void;
  },
  untracked(fn) {
    return globalContext.untracked(fn);
  },
};

setExpect(expect);

for (const { section, cases } of testSuite) {
  describe(section, () => {
    for (const [name, fn] of Object.entries(cases)) {
      test(name, (context) => {
        try {
          framework.run(() => fn(framework));
        } catch (e) {
          // Reported as skipped rather than swallowed, so an unsupported capability can never
          // be mistaken for a passing case.
          if (e instanceof SkipTest) return context.skip(e.reason);
          throw e;
        }
      });
    }
  });
}
