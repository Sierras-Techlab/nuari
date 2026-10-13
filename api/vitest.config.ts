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
    include: ['**/*.spec.ts'],
  },
});
