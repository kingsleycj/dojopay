export const lamportsToSol = (lamports: string | number, adjustFactor = 1): string => {
    const lamportsNum = typeof lamports === 'string' ? parseInt(lamports, 10) : lamports;
    const sol = (lamportsNum / 1000000000) * adjustFactor; // 1 SOL = 1,000,000,000 lamports
    return sol.toFixed(2); // Show 2 decimal places
};