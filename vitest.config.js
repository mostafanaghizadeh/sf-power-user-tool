import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/utils/**', 'src/storage/**'],
      thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 },
    },
  },
});
