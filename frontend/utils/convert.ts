export const lamportsToSol = (lamports: string | number, adjustFactor = 1): string => {
    const lamportsNum = typeof lamports === 'string' ? parseInt(lamports, 10) : lamports;
    const sol = (lamportsNum / 1000000) * adjustFactor; // Using 1,000,000 as base instead of 1,000,000,000
    return sol.toFixed(2); // Show 2 decimal places
};