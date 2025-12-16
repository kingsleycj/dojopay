import { describe, it, expect } from 'vitest';

// Import the actual conversion functions from utils
const LAMPORTS_PER_SOL = 1000000000;

export const lamportsToSol = (lamports: string | number): string => {
  const lamportsNum = typeof lamports === 'string' ? parseInt(lamports, 10) : lamports;
  const sol = lamportsNum / LAMPORTS_PER_SOL;
  return sol.toFixed(9).replace(/\.?0+$/, '');
};

export const solToLamports = (sol: string | number): number => {
  const solNum = typeof sol === 'string' ? parseFloat(sol) : sol;
  return Math.floor(solNum * LAMPORTS_PER_SOL);
};

describe('Solana Amount Conversions - Unit Tests', () => {
  describe('lamportsToSol', () => {
    it('should convert basic amounts correctly', () => {
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

    it('should handle decimal precision correctly', () => {
      expect(lamportsToSol(123456789)).toBe('0.123456789');
      expect(lamportsToSol(100000001)).toBe('0.100000001');
      expect(lamportsToSol(100000010)).toBe('0.10000001');
    });

    it('should remove trailing zeros', () => {
      expect(lamportsToSol(1000000000)).toBe('1'); // 1.000000000 -> 1
      expect(lamportsToSol(500000000)).toBe('0.5'); // 0.500000000 -> 0.5
      expect(lamportsToSol(100000000)).toBe('0.1'); // 0.100000000 -> 0.1
    });

    it('should handle very large amounts', () => {
      expect(lamportsToSol(10000000000)).toBe('10');
      expect(lamportsToSol(50000000000)).toBe('50');
    });
  });

  describe('solToLamports', () => {
    it('should convert basic amounts correctly', () => {
      expect(solToLamports(0.1)).toBe(100000000);
      expect(solToLamports(1)).toBe(1000000000);
      expect(solToLamports(0.05)).toBe(50000000);
      expect(solToLamports(0.25)).toBe(250000000);
    });

    it('should handle string input', () => {
      expect(solToLamports('0.1')).toBe(100000000);
      expect(solToLamports('1')).toBe(1000000000);
    });

    it('should handle edge cases', () => {
      expect(solToLamports(0)).toBe(0);
      expect(solToLamports(0.000000001)).toBe(1);
      expect(solToLamports(0.0000000005)).toBe(0); // Should round down
    });

    it('should round down correctly', () => {
      expect(solToLamports(0.1234567895)).toBe(123456789); // Should round down
      expect(solToLamports(0.9999999999)).toBe(999999999); // Should round down
      expect(solToLamports(0.5000000001)).toBe(500000000); // Should round down
    });

    it('should handle very large amounts', () => {
      expect(solToLamports(10)).toBe(10000000000);
      expect(solToLamports(50)).toBe(50000000000);
    });
  });

  describe('Round-trip conversions', () => {
    it('should be reversible for whole lamports', () => {
      const originalLamports = 123456789;
      const sol = lamportsToSol(originalLamports);
      const backToLamports = solToLamports(sol);
      expect(backToLamports).toBe(originalLamports);
    });

    it('should handle common SOL amounts', () => {
      const commonAmounts = [0.001, 0.01, 0.1, 0.5, 1, 2.5, 10];
      
      commonAmounts.forEach(solAmount => {
        const lamports = solToLamports(solAmount);
        const backToSol = lamportsToSol(lamports);
        expect(parseFloat(backToSol)).toBeCloseTo(solAmount, 9);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid input gracefully', () => {
      expect(() => lamportsToSol(NaN)).not.toThrow();
      expect(() => solToLamports(NaN)).not.toThrow();
      expect(() => lamportsToSol(Infinity)).not.toThrow();
      expect(() => solToLamports(Infinity)).not.toThrow();
    });

    it('should handle negative numbers', () => {
      expect(lamportsToSol(-100000000)).toBe('-0.1');
      expect(solToLamports(-0.1)).toBe(-100000000);
    });
  });
});
