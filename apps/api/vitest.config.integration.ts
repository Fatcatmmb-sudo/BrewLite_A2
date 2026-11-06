import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.integration-spec.ts'],
    setupFiles: ['reflect-metadata'],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
