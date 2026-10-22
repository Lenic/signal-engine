import type { ReactiveFramework } from 'reactive-framework-test-suite';

import { testSuite, SkipTest, setExpect } from 'reactive-framework-test-suite';
import { describe, expect, test } from 'vitest';

import { EffectAction } from '../base/effect-action';
import { globalContext } from '../base/global-context';
import { MemoValue } from '../base/memo-value';
import { SignalValue } from '../base/signal-value';
import { BatchScope } from '../utils';

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
    const ctx = BatchScope.begin();
    try {
      result = fn();
    } finally {
      BatchScope.end(ctx);
    }
    return result as void;
  },
  untracked(fn) {
    // Reads are tracked by whichever manager is active, so clearing it suppresses tracking.
    const previousActiveEffect = globalContext.activeEffect;
    const previousEffectRunning = globalContext.isEffectRunning;
    const previousActiveOwner = globalContext.activeOwner;
    globalContext.activeEffect = undefined;
    globalContext.isEffectRunning = false;
    globalContext.activeOwner = undefined;
    try {
      return fn();
    } finally {
      globalContext.activeEffect = previousActiveEffect;
      globalContext.isEffectRunning = previousEffectRunning;
      globalContext.activeOwner = previousActiveOwner;
    }
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
