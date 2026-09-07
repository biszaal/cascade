import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The engine is pure TypeScript with zero React Native imports, so it needs no native
// transform - vitest runs it directly in node.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
