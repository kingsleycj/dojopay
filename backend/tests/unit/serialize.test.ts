import { describe, it, expect } from "vitest";
import { lamportsToSol, toJsonSafe } from "../../src/utils/serialize.js";

describe("toJsonSafe", () => {
  it("converts BigInt to string so JSON.stringify cannot throw", () => {
    const payload = toJsonSafe({ amount: 100_000_000n });
    expect(payload).toEqual({ amount: "100000000" });
    expect(() => JSON.stringify(payload)).not.toThrow();
  });

  it("converts Date to ISO string", () => {
    const date = new Date("2026-01-15T10:30:00.000Z");
    expect(toJsonSafe({ createdAt: date })).toEqual({ createdAt: "2026-01-15T10:30:00.000Z" });
  });

  it("walks nested objects and arrays", () => {
    const result = toJsonSafe({
      task: {
        amount: 5n,
        options: [{ id: 1, price: 10n }, { id: 2, price: 20n }],
      },
    });

    expect(result).toEqual({
      task: {
        amount: "5",
        options: [{ id: 1, price: "10" }, { id: 2, price: "20" }],
      },
    });
  });

  it("preserves null, undefined, booleans and numbers", () => {
    expect(toJsonSafe({ a: null, b: undefined, c: true, d: 42 })).toEqual({
      a: null,
      b: undefined,
      c: true,
      d: 42,
    });
  });

  it("survives a realistic task payload end to end", () => {
    const serialized = JSON.stringify(
      toJsonSafe({
        id: 1,
        amount: 100_000_000n,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        submissions: [{ amount: 1_000_000n, createdAt: new Date("2026-01-02T00:00:00.000Z") }],
      }),
    );

    expect(JSON.parse(serialized)).toEqual({
      id: 1,
      amount: "100000000",
      createdAt: "2026-01-01T00:00:00.000Z",
      submissions: [{ amount: "1000000", createdAt: "2026-01-02T00:00:00.000Z" }],
    });
  });
});

describe("lamportsToSol", () => {
  it("converts known amounts", () => {
    expect(lamportsToSol(100_000_000n)).toBe(0.1);
    expect(lamportsToSol(1_000_000_000n)).toBe(1);
    expect(lamportsToSol(1_000_000n)).toBe(0.001);
    expect(lamportsToSol(0n)).toBe(0);
  });

  it("accepts strings and numbers", () => {
    expect(lamportsToSol("100000000")).toBe(0.1);
    expect(lamportsToSol(100_000_000)).toBe(0.1);
  });
});
