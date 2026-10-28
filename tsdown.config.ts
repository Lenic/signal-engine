import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: true,
  target: 'es2022',
  exports: true,
  fixedExtension: false,
  outDir: 'dist',
  sourcemap: true,
  entry: './src/index.ts',
});
