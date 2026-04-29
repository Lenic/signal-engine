import { signal } from './signal';
import { effect } from './effect';
import { memo } from './memo';
import { batch } from './runtime';

function test(name: string, fn: () => void) {
  console.log(`\n[TEST] ${name}`);
  fn();
}

test('basic reactivity', () => {
  const count = signal(0);

  effect(() => {
    console.log('effect:', count());
  });

  count.set(1);
  count.set(2);
});

test('no trigger same value', () => {
  const count = signal(1);

  effect(() => {
    console.log('run:', count());
  });

  count.set(1);
});

test('dynamic dependency', () => {
  const a = signal(1);
  const b = signal(10);
  const flag = signal(true);

  effect(() => {
    if (flag()) {
      console.log('A:', a());
    } else {
      console.log('B:', b());
    }
  });

  flag.set(false);
  b.set(20);
  a.set(999);
});

test('nested effect', () => {
  const a = signal(1);

  effect(() => {
    console.log('outer:', a());

    effect(() => {
      console.log('inner:', a());
    });
  });

  a.set(2);
});

test('memo lazy', () => {
  const count = signal(1);

  const double = memo(() => {
    console.log('compute');
    return count() * 2;
  });

  console.log(double());
  console.log(double());

  count.set(2);

  console.log(double());
});

test('memo chain', () => {
  const a = signal(1);
  const b = memo(() => a() + 1);
  const c = memo(() => b() + 1);

  effect(() => {
    console.log('c:', c());
  });

  a.set(2);
});

test('dispose', () => {
  const count = signal(1);

  const stop = effect(() => {
    console.log('run:', count());
  });

  stop();

  count.set(2);
});

test('infinite loop detect', () => {
  const count = signal(0);

  try {
    effect(() => {
      count.set(count() + 1);
    });
  } catch (e) {
    console.log('caught:', (e as Error).message);
  }
});

test('synchronous batching', () => {
  const a = signal(1);
  const b = signal(2);
  let runCount = 0;

  effect(() => {
    console.log('sum:', a() + b());
    runCount++;
  });

  console.log('Starting batch...');
  batch(() => {
    a.set(10);
    b.set(20);
    console.log('Inside batch, should not have triggered yet. runCount:', runCount);
  });
  console.log('End of batch. runCount:', runCount);
});

test('memo disposal', () => {
  const source = signal(1);
  let computeCount = 0;

  const m = memo(() => {
    computeCount++;
    return source() * 2;
  });

  console.log('val:', m());
  source.set(2);
  console.log('val:', m());

  m.dispose();
  source.set(3);
  console.log('After dispose, val:', m());
  console.log('Compute count after dispose:', computeCount);
});

test('automatic cleanup', () => {
  const source = signal(1);
  let memoComputeCount = 0;

  const stop = effect(() => {
    const m = memo(() => {
      memoComputeCount++;
      return source();
    });
    console.log('effect uses memo:', m());
  });

  source.set(2);
  console.log('memoComputeCount:', memoComputeCount);

  stop();
  source.set(3);
  console.log('After effect stop, memoComputeCount should not increase. count:', memoComputeCount);
});
