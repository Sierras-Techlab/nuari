import { defineConfig } from 'vitest/config';
import { nestTypescript } from './test/typescript-plugin.js';

export default defineConfig({
  plugins: [nestTypescript()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
