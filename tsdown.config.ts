import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: true,
  target: 'es2021',
  exports: true,
  outDir: 'dist',
  sourcemap: true,
  entry: './src/index.ts',
});
