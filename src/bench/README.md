# Benchmarks

Compares `@lenic/signal` against three mature reactive cores on the same set of graphs.

```bash
pnpm bench
```

That builds the package and runs `src/bench/index.mjs` against `dist/`, so the numbers describe the
artifact that actually ships.

## What it measures

| Scenario | Shape it stresses |
| --- | --- |
| deep chain | propagation cost down a long dependency chain |
| fan-out | one source feeding many memos |
| diamond | repeated convergence — the classic glitch shape |
| dynamic deps | dependency sets that change on every run |
| wide sources | one reader subscribed to many sources |
| cached reads | reading a memo whose inputs never move |
| creation | the cost of building signals and memos at all |
| effect create+dispose | subscription lifecycle churn |
| batched writes | write coalescing |

## Reading the output

Cells are milliseconds, median of `BENCH_SAMPLES` runs (7 by default), lower is better. Set the
sample count with an environment variable:

```bash
BENCH_SAMPLES=15 pnpm bench
```

Two things guard the numbers:

- **A semantic check runs first.** Every adapter is driven through the same small graph and must
  agree on tracking, caching, branch switching and stale-dependency pruning. A mismatch aborts
  the run — a library that quietly does less work would otherwise post excellent timings.
- **Every scenario returns a checksum**, compared across libraries. Disagreement is reported
  inline under the row.

`n/a` means the library exposes no primitive for that scenario, not that it failed;
`@vue/reactivity` ships no synchronous batching primitive of its own, so it sits out that row.

## Caveats

Microbenchmarks describe microbenchmarks. These graphs are synthetic, they run in isolation with
nothing else competing for the machine, and the ranking can shift with graph shape, update
frequency and payload size. Treat them as a signal about where the cost sits, not as a verdict.

Timings are also comparable only within a single run on one machine. Do not compare a number
here against one captured on different hardware or a different Node version.
