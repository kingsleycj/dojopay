import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@/utils': resolve(__dirname, 'utils'),
      '@/components': resolve(__dirname, 'components'),
      '@/app': resolve(__dirname, 'app'),
    },
  },
});
