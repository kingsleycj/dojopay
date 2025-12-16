import { describe, it, expect } from 'vitest';
import { lamportsToSol, solToLamports } from '@/utils/convert';

describe('Solana Conversions - Frontend Unit Tests', () => {
  describe('lamportsToSol', () => {
    it('should convert lamports to SOL correctly', () => {
      expect(lamportsToSol(100000000)).toBe('0.1');
      expect(lamportsToSol(1000000000)).toBe('1');
      expect(lamportsToSol(50000000)).toBe('0.05');
      expect(lamportsToSol(250000000)).toBe('0.25');
    });

    it('should handle string input', () => {
      expect(lamportsToSol('100000000')).toBe('0.1');
      expect(lamportsToSol('1000000000')).toBe('1');
    });

    it('should handle edge cases', () => {
      expect(lamportsToSol(0)).toBe('0');
      expect(lamportsToSol(1)).toBe('0.000000001');
      expect(lamportsToSol(999999999)).toBe('0.999999999');
    });

    it('should remove trailing zeros', () => {
      expect(lamportsToSol(1000000000)).toBe('1');
      expect(lamportsToSol(500000000)).toBe('0.5');
      expect(lamportsToSol(100000000)).toBe('0.1');
    });

    it('should handle decimal precision correctly', () => {
      expect(lamportsToSol(123456789)).toBe('0.123456789');
      expect(lamportsToSol(100000001)).toBe('0.100000001');
    });
  });

  describe('solToLamports', () => {
    it('should convert SOL to lamports correctly', () => {
      expect(solToLamports(0.1)).toBe(100000000);
      expect(solToLamports(1)).toBe(1000000000);
      expect(solToLamports(0.05)).toBe(50000000);
      expect(solToLamports(0.25)).toBe(250000000);
    });

    it('should handle string input', () => {
      expect(solToLamports('0.1')).toBe(100000000);
      expect(solToLamports('1')).toBe(1000000000);
    });

    it('should round down correctly', () => {
      expect(solToLamports(0.1234567895)).toBe(123456789);
      expect(solToLamports(0.9999999999)).toBe(999999999);
    });

    it('should handle edge cases', () => {
      expect(solToLamports(0)).toBe(0);
      expect(solToLamports(0.000000001)).toBe(1);
      expect(solToLamports(0.0000000005)).toBe(0);
    });
  });

  describe('Round-trip conversions', () => {
    it('should be reversible for common amounts', () => {
      const amounts = [0.001, 0.01, 0.1, 0.5, 1, 2.5, 10];
      
      amounts.forEach(solAmount => {
        const lamports = solToLamports(solAmount);
        const backToSol = lamportsToSol(lamports);
        expect(parseFloat(backToSol)).toBeCloseTo(solAmount, 9);
      });
    });

    it('should handle typical task amounts', () => {
      const taskAmounts = [0.05, 0.1, 0.25, 0.5, 1.0];
      
      taskAmounts.forEach(solAmount => {
        const lamports = solToLamports(solAmount);
        const backToSol = lamportsToSol(lamports);
        expect(parseFloat(backToSol)).toBe(solAmount);
      });
    });
  });
});
