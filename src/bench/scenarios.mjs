/**
 * Each scenario returns a checksum. The runner compares checksums across libraries, which is
 * what keeps the timings meaningful - a library that quietly skipped work would otherwise look
 * like the fastest one here.
 */
export const scenarios = [
  {
    name: 'deep chain (depth 50, 5k writes)',
    run(fw) {
      const src = fw.signal(0);
      let node = src;
      for (let i = 0; i < 50; i++) {
        const prev = node;
        node = fw.computed(() => prev.read() + 1);
      }

      let sum = 0;
      fw.effect(() => {
        sum += node.read();
      });

      for (let i = 1; i <= 5000; i++) src.write(i);
      return sum;
    },
  },
  {
    name: 'fan-out (1 source, 100 memos, 1k writes)',
    run(fw) {
      const src = fw.signal(0);
      const layer = [];
      for (let i = 0; i < 100; i++) layer.push(fw.computed(() => src.read() + i));

      let sum = 0;
      fw.effect(() => {
        let acc = 0;
        for (const c of layer) acc += c.read();
        sum += acc;
      });

      for (let i = 1; i <= 1000; i++) src.write(i);
      return sum;
    },
  },
  {
    name: 'diamond (width 20, 5k writes)',
    run(fw) {
      const src = fw.signal(0);
      const mid = [];
      for (let i = 0; i < 20; i++) mid.push(fw.computed(() => src.read() * 2));

      const join = fw.computed(() => {
        let acc = 0;
        for (const m of mid) acc += m.read();
        return acc;
      });

      let sum = 0;
      fw.effect(() => {
        sum += join.read();
      });

      for (let i = 1; i <= 5000; i++) src.write(i);
      return sum;
    },
  },
  {
    name: 'dynamic deps (branch switch, 10k writes)',
    run(fw) {
      const flag = fw.signal(true);
      const a = fw.signal(1);
      const b = fw.signal(2);
      const c = fw.computed(() => (flag.read() ? a.read() : b.read()));

      let sum = 0;
      fw.effect(() => {
        sum += c.read();
      });

      for (let i = 1; i <= 10000; i++) {
        flag.write(i % 2 === 0);
        // Writing whichever branch is currently inactive must cost nothing.
        if (i % 2 === 0) a.write(i);
        else b.write(i);
      }
      return sum;
    },
  },
  {
    name: 'wide sources (100 signals, 10k writes)',
    run(fw) {
      const sigs = [];
      for (let i = 0; i < 100; i++) sigs.push(fw.signal(i));

      let sum = 0;
      fw.effect(() => {
        let acc = 0;
        for (const s of sigs) acc += s.read();
        sum += acc;
      });

      for (let i = 1; i <= 10000; i++) sigs[i % 100].write(i);
      return sum;
    },
  },
  {
    name: 'cached reads (1M reads, no writes)',
    run(fw) {
      const a = fw.signal(2);
      const b = fw.signal(3);
      const c = fw.computed(() => a.read() * b.read());

      let sum = 0;
      for (let i = 0; i < 1_000_000; i++) sum += c.read();
      return sum;
    },
  },
  {
    name: 'creation (20k signal+memo pairs)',
    run(fw) {
      let sum = 0;
      for (let i = 0; i < 20000; i++) {
        const s = fw.signal(i);
        const c = fw.computed(() => s.read() * 2);
        sum += c.read();
      }
      return sum;
    },
  },
  {
    name: 'effect create+dispose (20k)',
    run(fw) {
      const s = fw.signal(1);
      let sum = 0;
      for (let i = 0; i < 20000; i++) {
        const dispose = fw.effect(() => {
          sum += s.read();
        });
        dispose();
      }
      return sum;
    },
  },
  {
    name: 'batched writes (2k batches x 10)',
    needsBatch: true,
    run(fw) {
      const sigs = [];
      for (let i = 0; i < 10; i++) sigs.push(fw.signal(i));

      let runs = 0;
      fw.effect(() => {
        let acc = 0;
        for (const s of sigs) acc += s.read();
        runs += acc === 0 ? 0 : 1;
      });

      for (let i = 1; i <= 2000; i++) {
        fw.batch(() => {
          for (let k = 0; k < 10; k++) sigs[k].write(i + k);
        });
      }
      return runs;
    },
  },
];
