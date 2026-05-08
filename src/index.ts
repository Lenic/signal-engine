export * from './lib';

// import { Signal, Effect, Memo, Scheduler } from './sdk';

// const log = {
//   success: (...args: any[]) => console.log('\x1b[32m%s\x1b[0m', ...args),
//   error: (...args: any[]) => console.log('\x1b[31m%s\x1b[0m', ...args),
//   warn: (...args: any[]) => console.log('\x1b[33m%s\x1b[0m', ...args),
//   info: (...args: any[]) => console.log('\x1b[36m%s\x1b[0m', ...args),
//   title: (...args: any[]) => console.log('\n\x1b[1m\x1b[4m%s\x1b[0m', ...args),
// };

// function test<T>(name: string, fn: () => T, expect: T) {
//   log.title(`\n[TEST] ${name}`);
//   const actual = fn();

//   if (actual === expect) log.success(`✅ ${name} passed`);
//   else log.error(`❌ ${name} failed: expected ${expect}, got ${actual}`);
// }

// test('basic reactivity', () => {
//   const count = new Signal(1);
//   let res = 0;

//   new Effect(() => {
//     res += count.value;
//     log.info('effect:', count.value);
//   });

//   count.value = 2;
//   count.value = 3;

//   return res;
// }, 6);

// test('no trigger same value', () => {
//   const count = new Signal(1);
//   let runCount = 0;

//   new Effect(() => {
//     runCount++;
//     log.info('run:', count.value);
//   });

//   count.value = 1;

//   return runCount;
// }, 1);

// test('dynamic dependency', () => {
//   const a = new Signal(1);
//   const b = new Signal(10);
//   const flag = new Signal(true);
//   let runCount = 0;

//   new Effect(() => {
//     runCount++;
//     if (flag.value) {
//       log.info('A:', a.value);
//     } else {
//       log.info('B:', b.value);
//     }
//   });

//   flag.value = false;
//   b.value = 20;
//   a.value = 999;

//   return runCount;
// }, 3);

// test('nested effect', () => {
//   const a = new Signal(1);
//   let runCount = 0;

//   new Effect(() => {
//     runCount++;
//     log.info('outer:', a.value);

//     new Effect(() => {
//       runCount++;
//       log.info('inner:', a.value);
//     });
//   });

//   a.value = 2;

//   return runCount;
// }, 4);

// test('memo lazy', () => {
//   const count = new Signal(1);
//   let computeCount = 0;

//   const double = new Memo(() => {
//     computeCount++;
//     log.info('compute');
//     return count.value * 2;
//   });

//   log.info(double.value);
//   log.info(double.value);

//   count.value = 2;

//   log.info(double.value);

//   return computeCount;
// }, 2);

// test('memo chain', () => {
//   const a = new Signal(1);
//   const b = new Memo(() => a.value + 1);
//   const c = new Memo(() => b.value + 1);
//   let runCount = 0;

//   new Effect(() => {
//     runCount++;
//     log.info('c:', c.value);
//   });

//   a.value = 2;

//   return runCount;
// }, 2);

// test('dispose', () => {
//   const count = new Signal(1);
//   let runCount = 0;

//   const eff = new Effect(() => {
//     runCount++;
//     log.info('run:', count.value);
//   });

//   eff.stop();

//   count.value = 2;

//   return runCount;
// }, 1);

// test(
//   'infinite loop detect',
//   () => {
//     const count = new Signal(0);
//     let caught = false;

//     try {
//       new Effect(() => {
//         count.value = count.value + 1;
//       });
//     } catch (e) {
//       caught = true;
//       log.info('caught:', (e as Error).message);
//     }

//     return caught;
//   },
//   true,
// );

// test('synchronous batching', () => {
//   const a = new Signal(1);
//   const b = new Signal(2);
//   let runCount = 0;

//   new Effect(() => {
//     log.info('sum:', a.value + b.value);
//     runCount++;
//   });

//   log.info('Starting batch...');
//   Scheduler.batch(() => {
//     a.value = 10;
//     b.value = 20;
//     log.info('Inside batch, should not have triggered yet. runCount:', runCount);
//   });
//   log.info('End of batch. runCount:', runCount);

//   return runCount;
// }, 2);

// test('memo disposal', () => {
//   const source = new Signal(1);
//   let computeCount = 0;

//   const m = new Memo(() => {
//     computeCount++;
//     return source.value * 2;
//   });

//   log.info('val:', m.value);
//   source.value = 2;
//   log.info('val:', m.value);

//   m.stop();
//   source.value = 3;
//   log.info('After dispose, val:', m.value);
//   log.info('Compute count after dispose:', computeCount);

//   return computeCount;
// }, 2);

// test('automatic cleanup', () => {
//   const source = new Signal(1);
//   let memoComputeCount = 0;

//   const eff = new Effect(() => {
//     const m = new Memo(() => {
//       memoComputeCount++;
//       return source.value;
//     });
//     log.info('effect uses memo:', m.value);
//   });

//   source.value = 2;
//   log.info('memoComputeCount:', memoComputeCount);

//   eff.stop();
//   source.value = 3;
//   log.info('After effect stop, memoComputeCount should not increase. count:', memoComputeCount);

//   return memoComputeCount;
// }, 2);

// test('diamond dependency (glitch)', () => {
//   const s = new Signal(1);
//   const m1 = new Memo(() => {
//     log.info('  [Compute M1]');
//     return s.value + 1;
//   });
//   const m2 = new Memo(() => {
//     log.info('  [Compute M2]');
//     return s.value + 2;
//   });

//   let effectRunCount = 0;
//   new Effect(() => {
//     effectRunCount++;
//     log.info('  [Effect Run] sum:', m1.value + m2.value);
//   });

//   log.info('--- updating s.value = 10 ---');
//   s.value = 10;
//   log.info('Final effectRunCount:', effectRunCount);

//   return effectRunCount;
// }, 2);
