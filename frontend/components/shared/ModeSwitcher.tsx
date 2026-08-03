"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/components/lib/utils";
import { useAuth, type Mode } from "@/lib/auth";

/**
 * The creator/worker switch.
 *
 * One account is both, so this is a view toggle, not a second sign-in — the
 * session already authorises both sides and profiles are created lazily on first
 * use. The previous version did `window.location.href = ...`, which meant a full
 * page reload, a white flash, and the wallet adapter tree recompiling: switching
 * modes felt like leaving the product.
 *
 * This navigates client-side and animates the pill between the two halves, so
 * the switch reads as changing what you are looking at rather than where you
 * are. The sliding indicator is a single absolutely-positioned element rather
 * than per-button backgrounds, which is what makes the movement continuous.
 */

const MODES: Array<{ value: Mode; label: string; short: string }> = [
  { value: "worker", label: "Earn", short: "Earn" },
  { value: "creator", label: "Post", short: "Post" },
];

export function ModeSwitcher({ className }: { className?: string }) {
  const { mode, setMode } = useAuth();
  const router = useRouter();
  const [switching, setSwitching] = useState<Mode | null>(null);

  const activeIndex = MODES.findIndex((entry) => entry.value === mode);

  const switchTo = useCallback(
    (next: Mode) => {
      if (next === mode || switching) return;

      // Set the mode first so the accent and the pill move immediately, then
      // navigate. Waiting for the route would leave the control feeling dead
      // for the length of the transition.
      setMode(next);
      setSwitching(next);
      router.push(`/${next}/dashboard`);

      // Cleared on a timer rather than on route completion: `router.push` gives
      // no completion signal in the App Router, and leaving the control disabled
      // forever if navigation stalls would be worse than releasing it early.
      window.setTimeout(() => setSwitching(null), 600);
    },
    [mode, router, setMode, switching],
  );

  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-full border border-border bg-muted/60 p-1",
        className,
      )}
      role="tablist"
      aria-label="Switch between earning and posting"
    >
      {/*
        The moving indicator. Positioned by percentage so it tracks whatever
        width the container ends up at, rather than assuming a fixed size.
      */}
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-full bg-card shadow-sm transition-[left] duration-300"
        style={{
          width: `calc(${100 / MODES.length}% - 0.25rem)`,
          left: `calc(${(activeIndex * 100) / MODES.length}% + 0.25rem)`,
          transitionTimingFunction: "var(--ease-out-soft)",
        }}
      />

      {MODES.map((entry) => {
        const isActive = entry.value === mode;
        return (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => switchTo(entry.value)}
            className={cn(
              "app-focus-ring relative z-10 flex-1 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
              isActive ? "text-accent-mode" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact variant for the mobile navigation drawer, where the segmented control
 * competes for width with everything else in the header.
 */
export function ModeSwitcherRow() {
  const { mode } = useAuth();

  return (
    <div className="px-3 py-2">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-widest text-muted-foreground">
        You are {mode === "creator" ? "posting work" : "earning"}
      </p>
      <ModeSwitcher className="w-full" />
    </div>
  );
}
