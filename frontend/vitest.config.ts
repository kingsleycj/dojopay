import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@/components': resolve(__dirname, './components'),
      '@/app': resolve(__dirname, './app'),
      '@/utils': resolve(__dirname, './utils'),
    },
  },
  include: [
    'tests/**/*.test.ts',
    'tests/**/*.test.tsx',
    'tests/**/*.spec.ts',
    'tests/**/*.spec.tsx',
  ],
  exclude: [
    'node_modules',
    'dist',
    '.next',
  ],
});
