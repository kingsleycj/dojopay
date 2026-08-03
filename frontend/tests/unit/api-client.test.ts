import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildWithdrawalMessage } from "@/lib/api";
import { clearTokens, getToken, setToken } from "@/lib/api/client";

/**
 * The withdrawal message must match the backend's `buildWithdrawalMessage`
 * byte for byte, or `nacl.sign.detached.verify` fails and every withdrawal is
 * rejected. This pair drifting apart is exactly what broke the earnings page.
 */
describe("buildWithdrawalMessage", () => {
  it("matches the backend format exactly", () => {
    expect(buildWithdrawalMessage("5000000", "ABC123")).toBe(
      "Withdraw 5000000 lamports to ABC123",
    );
  });

  it("does not reformat the lamport amount", () => {
    // No thousands separators, no SOL conversion, no scientific notation.
    const message = buildWithdrawalMessage("100000000000", "ABC123");
    expect(message).toBe("Withdraw 100000000000 lamports to ABC123");
    expect(message).not.toContain(",");
    expect(message).not.toContain("e+");
  });
});

describe("token storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps creator and worker tokens in separate slots", () => {
    setToken("creator", "creator-token");
    setToken("worker", "worker-token");

    expect(getToken("creator")).toBe("creator-token");
    expect(getToken("worker")).toBe("worker-token");
  });

  it("clears both roles at once", () => {
    setToken("creator", "creator-token");
    setToken("worker", "worker-token");

    clearTokens();

    expect(getToken("creator")).toBeNull();
    expect(getToken("worker")).toBeNull();
  });

  /**
   * The auth context listens for this event instead of polling localStorage on
   * a 1-second interval, which is what every page used to do.
   */
  it("emits an auth-changed event on write and clear", () => {
    const listener = vi.fn();
    window.addEventListener("dojopay:auth-changed", listener);

    setToken("worker", "token");
    expect(listener).toHaveBeenCalledTimes(1);

    clearTokens();
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener("dojopay:auth-changed", listener);
  });
});
