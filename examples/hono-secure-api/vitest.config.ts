import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run tests sequentially to avoid worker pool conflicts
    pool: 'forks',
    // Note: poolOptions.forks.singleFork is not available in current vitest version
    // Using pool: 'forks' alone should provide sequential execution
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts']
    }
  }
});
