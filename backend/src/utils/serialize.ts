/**
 * BigInt-safe serialization.
 *
 * Lamport amounts are `BigInt` in the database. `JSON.stringify` throws on
 * BigInt, so the old code sprinkled `.toString()` at every call site — and
 * missed some, which is why a few endpoints 500'd on serialization. Run
 * outbound payloads through `toJsonSafe` instead.
 */

export type JsonSafe<T> = T extends bigint
  ? string
  : T extends Date
    ? string
    : T extends Array<infer U>
      ? JsonSafe<U>[]
      : T extends object
        ? { [K in keyof T]: JsonSafe<T[K]> }
        : T;

export function toJsonSafe<T>(value: T): JsonSafe<T> {
  if (typeof value === "bigint") return value.toString() as JsonSafe<T>;
  if (value instanceof Date) return value.toISOString() as JsonSafe<T>;
  if (Array.isArray(value)) return value.map(toJsonSafe) as JsonSafe<T>;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = toJsonSafe(inner);
    }
    return out as JsonSafe<T>;
  }
  return value as JsonSafe<T>;
}

/** Lamports → SOL, for display only. Never use the result for arithmetic. */
export function lamportsToSol(lamports: bigint | number | string): number {
  return Number(BigInt(lamports)) / 1_000_000_000;
}
