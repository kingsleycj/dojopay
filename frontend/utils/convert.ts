import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export const lamportsToSol = (lamports: string | number): string => {
    const lamportsNum = typeof lamports === 'string' ? parseInt(lamports, 10) : lamports;
    const sol = lamportsNum / LAMPORTS_PER_SOL;
    return sol.toFixed(9).replace(/\.?0+$/, ''); // Remove trailing zeros, show up to 9 decimal places
};

export const solToLamports = (sol: string | number): number => {
    const solNum = typeof sol === 'string' ? parseFloat(sol) : sol;
    return Math.floor(solNum * LAMPORTS_PER_SOL);
};