import * as alien from 'alien-signals';
import * as preact from '@preact/signals-core';
import * as vue from '@vue/reactivity';

import * as lenic from '../../dist/index.mjs';

/**
 * Every library is driven through the same shape, so a scenario is written once and each
 * adapter is asked to do exactly the same work.
 *
 * `batch` is `null` for libraries that expose no synchronous batching primitive; scenarios that
 * need one are skipped for them rather than approximated.
 */
export const adapters = [
  {
    name: '@lenic/signal',
    signal: (value) => {
      const s = lenic.signal(value);
      return { read: () => s(), write: (next) => s(next) };
    },
    computed: (fn) => {
      const c = lenic.memo(fn);
      return { read: () => c() };
    },
    effect: (fn) => lenic.effect(fn),
    batch: (fn) => lenic.batch(fn),
  },
  {
    name: '@preact/signals-core',
    signal: (value) => {
      const s = preact.signal(value);
      return {
        read: () => s.value,
        write: (next) => {
          s.value = next;
        },
      };
    },
    computed: (fn) => {
      const c = preact.computed(fn);
      return { read: () => c.value };
    },
    effect: (fn) => preact.effect(fn),
    batch: (fn) => preact.batch(fn),
  },
  {
    name: 'alien-signals',
    signal: (value) => {
      const s = alien.signal(value);
      return { read: () => s(), write: (next) => s(next) };
    },
    computed: (fn) => {
      const c = alien.computed(() => fn());
      return { read: () => c() };
    },
    effect: (fn) => alien.effect(fn),
    batch: (fn) => {
      alien.startBatch();
      try {
        fn();
      } finally {
        alien.endBatch();
      }
    },
  },
  {
    name: '@vue/reactivity',
    signal: (value) => {
      const s = vue.shallowRef(value);
      return {
        read: () => s.value,
        write: (next) => {
          s.value = next;
        },
      };
    },
    computed: (fn) => {
      const c = vue.computed(fn);
      return { read: () => c.value };
    },
    // `vue.effect` hands back a runner that re-runs the body when called, so it has to be
    // turned into a stop function to match what every other adapter returns.
    effect: (fn) => {
      const runner = vue.effect(fn);
      return () => vue.stop(runner);
    },
    batch: null,
  },
];
