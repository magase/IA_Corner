import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@corner/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/**'], exclude: ['src/main.ts'] },
  },
});
