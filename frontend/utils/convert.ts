import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Cache for SOL price to avoid excessive API calls
let solPriceCache: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Lamports to a display string in SOL.
 *
 * `decimals` caps the precision shown. Left unset it shows up to all nine, which
 * is right for a ledger row but wrong for a headline figure — a dashboard stat
 * reading `0.001234567` is harder to scan than `0.0012`, and the extra digits
 * are not decision-relevant there.
 *
 * Trailing zeros are always trimmed, so a whole number reads as `2` rather than
 * `2.0000`.
 */
export const lamportsToSol = (lamports: string | number, decimals = 9): string => {
    const clamped = Math.min(9, Math.max(0, Math.trunc(decimals)));

    // Integer arithmetic on the lamport value rather than dividing into a float
    // first: 9 decimal places do not survive IEEE-754, and this function renders
    // balances people act on.
    let value: bigint;
    try {
        value =
            typeof lamports === 'string'
                ? BigInt(lamports.trim() || '0')
                : BigInt(Math.trunc(Number.isFinite(lamports) ? lamports : 0));
    } catch {
        // A non-numeric amount reaching here means an API shape changed. Render
        // zero rather than `NaN`, which reads as a balance of unknown size.
        return '0';
    }

    const negative = value < 0n;
    if (negative) value = -value;

    const unit = BigInt(LAMPORTS_PER_SOL);
    const whole = value / unit;
    const fraction = (value % unit).toString().padStart(9, '0');

    /**
     * Truncated, never rounded.
     *
     * `toFixed` rounds, so a capped render of 1.999999999 SOL showed `2` — and a
     * withdraw button reading "Withdraw 2 SOL" against a balance of slightly
     * less is a guaranteed failure. Showing marginally less than is held is the
     * only safe direction to be wrong in.
     */
    const shown = fraction.slice(0, clamped).replace(/0+$/, '');
    const sign = negative ? '-' : '';

    return shown ? `${sign}${whole}.${shown}` : `${sign}${whole}`;
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