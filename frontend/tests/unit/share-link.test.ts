import { describe, it, expect } from "vitest";

/**
 * Share links are the onboarding entry point, so the rules that make them work
 * for a brand-new visitor are worth pinning down.
 */

/** Mirrors the guard in `app/page.tsx` — only same-origin relative paths. */
function isSafeRedirect(next: string | null): boolean {
  if (!next) return false;
  return next.startsWith("/") && !next.startsWith("//");
}

describe("post-signin redirect target", () => {
  it("accepts a relative task path", () => {
    expect(isSafeRedirect("/task/42")).toBe(true);
    expect(isSafeRedirect("/worker/tasks")).toBe(true);
  });

  it("rejects absolute URLs — an open redirect would let a share link send a signed-in user off-site", () => {
    expect(isSafeRedirect("https://evil.example/phish")).toBe(false);
    expect(isSafeRedirect("http://evil.example")).toBe(false);
  });

  it("rejects protocol-relative URLs, which browsers treat as absolute", () => {
    expect(isSafeRedirect("//evil.example/phish")).toBe(false);
  });

  it("rejects an empty or missing target", () => {
    expect(isSafeRedirect(null)).toBe(false);
    expect(isSafeRedirect("")).toBe(false);
  });
});

describe("share URL construction", () => {
  const build = (taskId: number, referrer?: string | null) => {
    const url = new URL(`/task/${taskId}`, "https://dojopay.vercel.app");
    if (referrer) url.searchParams.set("ref", referrer);
    return url.toString();
  };

  it("points at the public task route so a signed-out visitor can open it", () => {
    expect(build(42)).toBe("https://dojopay.vercel.app/task/42");
  });

  it("carries the referrer for attribution", () => {
    expect(build(42, "WalletABC")).toBe(
      "https://dojopay.vercel.app/task/42?ref=WalletABC",
    );
  });

  it("omits ref entirely when there is no referrer", () => {
    expect(build(42, null)).not.toContain("ref=");
  });
});
