/**
 * BigInt-safe serialization.
 *
 * Lamport amounts are `BigInt` in the database. `JSON.stringify` throws on
 * BigInt, so the old code sprinkled `.toString()` at every call site — and
 * missed some, which is why a few endpoints 500'd on serialization. Run
 * outbound payloads through `toJsonSafe` instead.
 */
export function toJsonSafe(value) {
    if (typeof value === "bigint")
        return value.toString();
    if (value instanceof Date)
        return value.toISOString();
    if (Array.isArray(value))
        return value.map(toJsonSafe);
    if (value !== null && typeof value === "object") {
        const out = {};
        for (const [key, inner] of Object.entries(value)) {
            out[key] = toJsonSafe(inner);
        }
        return out;
    }
    return value;
}
/** Lamports → SOL, for display only. Never use the result for arithmetic. */
export function lamportsToSol(lamports) {
    return Number(BigInt(lamports)) / 1_000_000_000;
}
//# sourceMappingURL=serialize.js.map