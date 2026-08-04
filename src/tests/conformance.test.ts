import { describe, expect, test } from 'vitest';
import { testSuite, SkipTest, setExpect, type ReactiveFramework } from 'reactive-framework-test-suite';
import { signal } from '../signal';
import { effect } from '../effect';
import { memo } from '../memo';
import { globalScheduler } from '../core';

const framework: ReactiveFramework = {
  signal(initialValue) {
    const s = signal(initialValue);
    return {
      read: () => s(),
      write: (v) => s(v),
    };
  },
  computed(fn) {
    const c = memo(fn);
    return { read: () => c() };
  },
  effect(fn) {
    // The suite's effects may return a cleanup function. Hand it to the running manager so it
    // is released before the next recomputation and on disposal - the same lifetime the suite
    // expects. Without this the suite detects no cleanup support and skips those cases.
    return effect(() => {
      const cleanup = fn();
      if (typeof cleanup === 'function') {
        globalScheduler.connectorManager?.adopt(cleanup);
      }
    });
  },
  run(fn) {
    fn();
  },
  batch(fn) {
    // `#176 batch return value` checks that the callback's return value is forwarded.
    let result: unknown;
    globalScheduler.batch(() => void (result = fn()));
    return result as void;
  },
  untracked(fn) {
    // Reads are tracked by whichever manager is active, so clearing it suppresses tracking.
    const previous = globalScheduler.connectorManager;
    globalScheduler.connectorManager = undefined;
    try {
      return fn();
    } finally {
      globalScheduler.connectorManager = previous;
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
