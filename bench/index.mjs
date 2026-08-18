import { adapters } from './adapters.mjs';
import { scenarios } from './scenarios.mjs';

const SAMPLES = Number(process.env.BENCH_SAMPLES ?? 7);

const now = () => Number(process.hrtime.bigint()) / 1e6;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pad = (s, n) => String(s).padEnd(n);
const padStart = (s, n) => String(s).padStart(n);

/**
 * Runs every adapter through the same reactive graph before any timing is trusted. A library
 * whose adapter is subtly wrong - not tracking, not caching, not batching - would otherwise post
 * excellent numbers for doing less work.
 */
function verifySemantics() {
  const expected = [
    'first=2',
    'after a=2: 4',
    'cached reads recompute 0 times',
    'after branch switch: 20',
    'inactive dep write: 20',
    'active dep write: 40',
  ];
  const failures = [];

  for (const fw of adapters) {
    const seen = [];
    const a = fw.signal(1);
    const b = fw.signal(10);
    const flag = fw.signal(true);

    let computeRuns = 0;
    const c = fw.computed(() => {
      computeRuns++;
      return flag.read() ? a.read() * 2 : b.read() * 2;
    });

    let value = 0;
    fw.effect(() => {
      value = c.read();
    });

    seen.push(`first=${value}`);
    a.write(2);
    seen.push(`after a=2: ${value}`);

    const before = computeRuns;
    c.read();
    c.read();
    seen.push(`cached reads recompute ${computeRuns - before} times`);

    flag.write(false);
    seen.push(`after branch switch: ${value}`);
    a.write(999);
    seen.push(`inactive dep write: ${value}`);
    b.write(20);
    seen.push(`active dep write: ${value}`);

    for (let i = 0; i < expected.length; i++) {
      if (seen[i] !== expected[i]) {
        failures.push(`${fw.name}: expected "${expected[i]}", got "${seen[i]}"`);
      }
    }
  }

  return failures;
}

const failures = verifySemantics();
if (failures.length) {
  console.error('\nAdapters disagree on behaviour, so the timings would be meaningless:\n');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}

const names = adapters.map((a) => a.name);
const width = Math.max(...names.map((n) => n.length)) + 4;

console.log(`\nnode ${process.version}   ${SAMPLES} samples per cell, median reported\n`);
console.log(pad('scenario', 42) + names.map((n) => padStart(n, width)).join(''));
console.log('-'.repeat(42 + names.length * width));

for (const scenario of scenarios) {
  const times = {};
  const checksums = {};

  for (const fw of adapters) {
    if (scenario.needsBatch && !fw.batch) continue;

    try {
      // Warm up first, so the timed samples measure steady state rather than the first JIT tier.
      scenario.run(fw);
      scenario.run(fw);

      const samples = [];
      for (let i = 0; i < SAMPLES; i++) {
        globalThis.gc?.();
        const start = now();
        checksums[fw.name] = scenario.run(fw);
        samples.push(now() - start);
      }
      times[fw.name] = median(samples);
    } catch (e) {
      checksums[fw.name] = 'threw: ' + e.message;
    }
  }

  const cells = names.map((n) => padStart(n in times ? times[n].toFixed(1) + ' ms' : 'n/a', width));
  console.log(pad(scenario.name, 42) + cells.join(''));

  const numeric = Object.entries(checksums).filter(([, v]) => typeof v === 'number');
  if (new Set(numeric.map(([, v]) => v)).size > 1) {
    console.log('   !! checksums disagree: ' + numeric.map(([k, v]) => `${k}=${v}`).join('  '));
  }
  for (const [k, v] of Object.entries(checksums).filter(([, v]) => typeof v === 'string')) {
    console.log(`   !! ${k} ${v}`);
  }
}

console.log('\nLower is better. "n/a" means the library exposes no primitive for that scenario.\n');
