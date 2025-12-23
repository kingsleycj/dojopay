import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Cache for SOL price to avoid excessive API calls
let solPriceCache: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const lamportsToSol = (lamports: string | number): string => {
    const lamportsNum = typeof lamports === 'string' ? parseInt(lamports, 10) : lamports;
    const sol = lamportsNum / LAMPORTS_PER_SOL;
    return sol.toFixed(9).replace(/\.?0+$/, ''); // Remove trailing zeros, show up to 9 decimal places
};

export const solToLamports = (sol: string | number): number => {
    const solNum = typeof sol === 'string' ? parseFloat(sol) : sol;
    return Math.floor(solNum * LAMPORTS_PER_SOL);
};

// Fetch real SOL price from CoinGecko API
const fetchSolPrice = async (): Promise<number> => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        return data.solana.usd;
    } catch (error) {
        console.error('Failed to fetch SOL price:', error);
        // Fallback to $200 if API fails
        return 200;
    }
};

// Get SOL price with caching
export const getSolPrice = async (): Promise<number> => {
    const now = Date.now();
    
    // Return cached price if still valid
    if (solPriceCache && (now - lastFetchTime) < CACHE_DURATION) {
        return solPriceCache;
    }
    
    // Fetch new price
    const price = await fetchSolPrice();
    solPriceCache = price;
    lastFetchTime = now;
    
    return price;
};

export const solToUsd = async (solAmount: string | number): Promise<string> => {
    const solNum = typeof solAmount === 'string' ? parseFloat(solAmount) : solAmount;
    const solPrice = await getSolPrice();
    const usdAmount = solNum * solPrice;
    return usdAmount.toFixed(2);
};

// Synchronous version with cached price (for immediate display)
export const solToUsdSync = (solAmount: string | number): string => {
    const solNum = typeof solAmount === 'string' ? parseFloat(solAmount) : solAmount;
    const solPrice = solPriceCache || 200; // Fallback to cached price or $200
    const usdAmount = solNum * solPrice;
    return usdAmount.toFixed(2);
};