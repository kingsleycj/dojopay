import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildWithdrawalMessage } from "@/lib/api";
import { clearLegacyTokens, clearToken, getToken, setToken } from "@/lib/api/client";

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

  /**
   * A user token must never be reachable from the admin client, and vice
   * versa — separate scopes are what makes that structural rather than a
   * matter of remembering.
   */
  it("keeps the account and admin sessions in separate slots", () => {
    setToken("account", "account-token");
    setToken("admin", "admin-token");

    expect(getToken("account")).toBe("account-token");
    expect(getToken("admin")).toBe("admin-token");
  });

  it("clears one scope without touching the other", () => {
    setToken("account", "account-token");
    setToken("admin", "admin-token");

    clearToken("account");

    expect(getToken("account")).toBeNull();
    // Signing out of the app must not sign you out of admin tooling.
    expect(getToken("admin")).toBe("admin-token");
  });

  /**
   * The auth context listens for this event instead of polling localStorage on
   * a 1-second interval, which is what every page used to do.
   */
  it("emits an auth-changed event on write and clear", () => {
    const listener = vi.fn();
    window.addEventListener("dojopay:auth-changed", listener);

    setToken("account", "token");
    expect(listener).toHaveBeenCalledTimes(1);

    clearToken("account");
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener("dojopay:auth-changed", listener);
  });

  /**
   * Tokens from the two-token era were signed with secrets that no longer
   * exist, so leaving them behind only produces confusing 401s.
   */
  it("drops legacy creator/worker tokens without touching current ones", () => {
    window.localStorage.setItem("token", "old-creator-token");
    window.localStorage.setItem("workerToken", "old-worker-token");
    setToken("account", "current-token");

    clearLegacyTokens();

    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("workerToken")).toBeNull();
    expect(getToken("account")).toBe("current-token");
  });
});
