import { vi, beforeAll, afterAll, expect } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Add React to global scope for tests
global.React = React;

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({
    taskId: '1',
    id: '1',
  }),
  useSearchParams: () => ({
    get: vi.fn(),
    getAll: vi.fn(),
    has: vi.fn(),
    entries: vi.fn(),
    forEach: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
  }),
  usePathname: () => '/test',
}));

// Mock Solana wallet adapter
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: { toString: () => 'test-public-key' },
    connected: true,
    connecting: false,
    disconnect: vi.fn(),
    connect: vi.fn(),
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
  }),
  useConnection: () => ({
    connection: {
      sendTransaction: vi.fn(),
    },
  }),
}));

// Mock toast notifications
vi.mock('../components/Toast', () => ({
  showToast: vi.fn(),
}));

// Global test setup
beforeAll(() => {
  console.log('Setting up frontend test environment...');
});

afterAll(() => {
  console.log('Frontend test environment cleaned up');
});
