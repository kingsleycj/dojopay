"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LogOut, Menu, Wallet, X } from "lucide-react";
import { ToastContainer } from "@/components/Toast";
import { Sol } from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { useWithdrawal } from "@/hooks/useWithdrawal";
import { useAuth, type Mode } from "@/lib/auth";
import { vaultEndpoints, workerEndpoints, type Vault, type WorkerBalance } from "@/lib/api";
import { ModeSwitcher } from "./ModeSwitcher";
import { SideNav } from "./SideNav";

/**
 * The chrome around every signed-in page.
 *
 * `data-mode` on the root is what drives the accent colour for everything
 * inside — see the `--mode-accent` block in globals.css. That is the whole
 * mechanism: no component below needs to know which mode is active, and the
 * colour change on switch happens in one place.
 *
 * The balance chip shows a *different number per mode* on purpose. A worker's
 * pending earnings and a creator's vault are separate balances that happen to
 * belong to the same person, and showing whichever is not relevant to the
 * current task is how someone ends up trying to fund a task out of money they
 * earned but have not withdrawn.
 */

export function AppShell({
  role,
  children,
}: {
  role: Mode;
  /** Legacy prop from the previous shell; the nav derives this from the URL now. */
  activeView?: string;
  children: React.ReactNode;
}) {
  const { account, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balance, setBalance] = useState<WorkerBalance | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);

  const loadBalances = useCallback(async () => {
    // Both are best-effort: the chip disappearing is a far better failure than
    // the whole shell erroring out around a working page.
    if (role === "worker") {
      try {
        setBalance(await workerEndpoints.balance());
      } catch {
        setBalance(null);
      }
    } else {
      try {
        setVault(await vaultEndpoints.summary());
      } catch {
        setVault(null);
      }
    }
  }, [role]);

  const { withdraw, isWithdrawing } = useWithdrawal(loadBalances);

  useEffect(() => {
    void loadBalances();
    const interval = setInterval(loadBalances, 30_000);
    return () => clearInterval(interval);
  }, [loadBalances]);

  // A route change should close the drawer; leaving it open over the new page
  // is the most common mobile-nav bug there is.
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const pending = balance?.pendingAmount ?? "0";
  const hasPending = pending !== "0";
  const needsWallet = Boolean(account && !account.walletAddress);

  return (
    <div data-mode={role} className="flex min-h-screen flex-col bg-background">
      <ToastContainer />

      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="app-focus-ring rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href={`/${role}/dashboard`} className="app-focus-ring flex items-center gap-2 rounded-lg px-1">
            <span className="text-lg font-bold tracking-tight">DojoPay</span>
            <span className="hidden rounded-full bg-accent-mode-soft px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-accent-mode sm:inline">
              {role === "creator" ? "Creator" : "Worker"}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ModeSwitcher className="hidden sm:inline-flex" />

          {/* Worker: pending earnings, with a one-click withdrawal. */}
          {role === "worker" && hasPending && !needsWallet && (
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-accent-mode-soft px-3 py-1.5 md:flex">
              <Sol lamports={pending} decimals={4} className="text-xs font-semibold text-accent-mode" />
              <button
                onClick={() => withdraw(pending)}
                disabled={isWithdrawing}
                className="app-focus-ring rounded px-2 py-0.5 text-xs font-semibold text-accent-mode hover:bg-card disabled:opacity-50"
              >
                {isWithdrawing ? "Withdrawing…" : "Withdraw"}
              </button>
            </div>
          )}

          {/* Creator: vault balance, linking to the top-up flow. */}
          {role === "creator" && vault && (
            <Link
              href="/creator/vault"
              className="app-focus-ring hidden items-center gap-2 rounded-lg border border-border bg-accent-mode-soft px-3 py-1.5 text-xs font-semibold text-accent-mode hover:bg-card md:flex"
            >
              <Wallet className="h-3.5 w-3.5" />
              <Sol lamports={vault.available} decimals={4} />
              <span className="font-normal opacity-70">available</span>
            </Link>
          )}

          <Link
            href="/settings"
            className="app-focus-ring relative flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground hover:bg-accent-mode-soft hover:text-accent-mode"
            aria-label="Settings"
          >
            {initials(account?.displayName ?? account?.email ?? "?")}
            {/* Someone who cannot be paid should see that at all times, not only
                at the moment they try to cash out. */}
            {needsWallet && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-amber-500"
                aria-label="Action needed"
              />
            )}
          </Link>

          <button
            onClick={signOut}
            className="app-focus-ring rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {needsWallet && (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          Connect a Solana wallet to {role === "creator" ? "top up your vault" : "withdraw your earnings"}.{" "}
          <Link href="/settings" className="font-semibold underline underline-offset-2">
            Set it up
          </Link>
        </div>
      )}

      <SideNav mode={role} mobileOpen={mobileOpen} onNavigate={closeMobile} />

      <main className={cn("flex-1 lg:pl-60", needsWallet ? "pt-[6.25rem]" : "pt-16")}>
        {children}
      </main>
    </div>
  );
}

/** Up to two initials for the account chip. Falls back to a single character. */
function initials(source: string): string {
  const cleaned = source.trim();
  if (!cleaned) return "?";

  const words = cleaned.split(/[\s@._-]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}
