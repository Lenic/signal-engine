// import { describe, expect, test } from 'vitest';
// import { testSuite, SkipTest, setExpect, type ReactiveFramework } from 'reactive-framework-test-suite';
// import { signal } from '../signal';
// import { effect } from '../effect';
// import { memo } from '../memo';
// import { scheduler } from '../core';

// const framework: ReactiveFramework = {
//   signal(initialValue) {
//     const s = signal(initialValue);
//     return {
//       read: () => s(),
//       write: (v) => s(v),
//     };
//   },
//   computed(fn) {
//     const c = memo(fn);
//     return { read: () => c() };
//   },
//   effect(fn) {
//     return effect(fn);
//   },
//   run(fn) {
//     fn();
//   },
//   batch(fn) {
//     scheduler.batch(() => fn());
//   },
//   untracked(fn) {
//     const prev = scheduler.activeSubscriber;
//     scheduler.activeSubscriber = null;
//     try {
//       return fn();
//     } finally {
//       scheduler.activeSubscriber = prev;
//     }
//   },
// };

// setExpect(expect);

// for (const { section, cases } of testSuite) {
//   describe(section, () => {
//     for (const [name, fn] of Object.entries(cases)) {
//       test(name, () => {
//         try {
//           framework.run(() => fn(framework));
//         } catch (e) {
//           if (e instanceof SkipTest) return;
//           throw e;
//         }
//       });
//     }
//   });
// }
