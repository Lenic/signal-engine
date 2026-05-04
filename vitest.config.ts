// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // 可以直接写 test / expect
    environment: 'node',
  },
});
