import { adapters } from './adapters.mjs';
import { scenarios } from './scenarios.mjs';

/**
 * A single cold measurement. `index.mjs` spawns a fresh process for every one of these, so the
 * timed run is the first time this process has ever executed the scenario: no warm-up, no JIT
 * tiers or inline caches left behind by earlier runs or by other libraries.
 *
 * Usage: node --expose-gc measure.mjs <library name> <scenario index>
 */
const [libName, index] = process.argv.slice(2);
const fw = adapters.find((a) => a.name === libName);
const scenario = scenarios[Number(index)];

if (!fw || !scenario) {
  console.error(`unknown library "${libName}" or scenario index "${index}"`);
  process.exit(2);
}

if (scenario.needsBatch && !fw.batch) {
  console.log(JSON.stringify({ skip: true }));
} else {
  try {
    globalThis.gc?.();
    const start = process.hrtime.bigint();
    const checksum = scenario.run(fw);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(JSON.stringify({ ms, checksum }));
  } catch (e) {
    console.log(JSON.stringify({ error: e.message }));
  }
}
