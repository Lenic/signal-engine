import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { adapters } from './adapters.mjs';
import { scenarios } from './scenarios.mjs';

const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 5);
if (!Number.isInteger(ROUNDS) || ROUNDS < 3) {
  console.error('BENCH_ROUNDS must be an integer >= 3 (the fastest and slowest runs are dropped).');
  process.exit(1);
}

const MEASURE = fileURLToPath(new URL('./measure.mjs', import.meta.url));
const pad = (s, n) => String(s).padEnd(n);
const padStart = (s, n) => String(s).padStart(n);

/**
 * Runs every adapter through the same reactive graph before any timing is trusted. A library
 * whose adapter is subtly wrong - not tracking, not caching, not batching - would otherwise post
 * excellent numbers for doing less work. This runs in the parent process only, so it cannot warm
 * up the measured runs.
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

/** Sorts the samples, drops the fastest and the slowest, and averages the rest. */
function trimmedMean(samples) {
  const sorted = [...samples].sort((a, b) => a - b).slice(1, -1);
  return sorted.reduce((acc, x) => acc + x, 0) / sorted.length;
}

function shuffle(xs) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

const failures = verifySemantics();
if (failures.length) {
  console.error('\nAdapters disagree on behaviour, so the timings would be meaningless:\n');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}

const names = adapters.map((a) => a.name);
// samples[scenarioIndex][libName] = number[]; checksums / errors keyed the same way.
const samples = scenarios.map(() => ({}));
const checksums = scenarios.map(() => ({}));
const errors = scenarios.map(() => ({}));

for (let round = 1; round <= ROUNDS; round++) {
  const jobs = [];
  scenarios.forEach((_, i) => names.forEach((name) => jobs.push([i, name])));

  // A fresh order every round, so no library always runs right after a particular other one.
  for (const [i, name] of shuffle(jobs)) {
    const output = execFileSync(process.execPath, ['--expose-gc', MEASURE, name, String(i)]);
    const result = JSON.parse(output.toString());
    if (result.skip) continue;
    if (result.error) {
      errors[i][name] = result.error;
      continue;
    }
    (samples[i][name] ??= []).push(result.ms);
    (checksums[i][name] ??= new Set()).add(result.checksum);
  }

  process.stderr.write(`\r  round ${round}/${ROUNDS}`);
}
process.stderr.write('\n');

const width = Math.max(...names.map((n) => n.length)) + 4;

console.log(
  `\nnode ${process.version}   cold start, ${ROUNDS} rounds per cell, ` +
    `fastest and slowest dropped, mean of the remaining ${ROUNDS - 2}\n`,
);
console.log(pad('scenario', 42) + names.map((n) => padStart(n, width)).join(''));
console.log('-'.repeat(42 + names.length * width));

scenarios.forEach((scenario, i) => {
  const cells = names.map((name) => {
    const xs = samples[i][name];
    return padStart(xs?.length === ROUNDS ? trimmedMean(xs).toFixed(2) + ' ms' : 'n/a', width);
  });
  console.log(pad(scenario.name, 42) + cells.join(''));

  const values = Object.entries(checksums[i]).flatMap(([name, set]) => [...set].map((v) => [name, v]));
  if (new Set(values.map(([, v]) => v)).size > 1) {
    console.log('   !! checksums disagree: ' + values.map(([k, v]) => `${k}=${v}`).join('  '));
  }
  for (const [name, message] of Object.entries(errors[i])) {
    console.log(`   !! ${name} threw: ${message}`);
  }
});

console.log('\nLower is better. "n/a" means the library exposes no primitive for that scenario.\n');
