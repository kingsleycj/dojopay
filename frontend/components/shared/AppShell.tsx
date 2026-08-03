"use client";

import { useCallback, useEffect, useState } from "react";
import { CreatorSidebar } from "@/components/CreatorSidebar";
import { WorkerSidebar } from "@/components/WorkerSidebar";
import { ApplicationFooter } from "@/components/ApplicationFooter";
import { ToastContainer } from "@/components/Toast";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { workerEndpoints, type WorkerBalance } from "@/lib/api";
import { useWithdrawal } from "@/hooks/useWithdrawal";
import { lamportsToSol } from "@/utils/convert";

/**
 * The chrome around every signed-in page: top bar, role sidebar, footer.
 *
 * Three near-identical `WorkerAppbar` components were previously defined inline
 * inside `app/worker/dashboard`, `app/worker/tasks` and `components/Appbar`,
 * each fetching the balance slightly differently. This is the one of them.
 */

type CreatorView = "dashboard" | "tasks" | "create" | "earnings";
type WorkerView = "dashboard" | "tasks" | "earnings";

interface AppShellProps {
  role: "creator" | "worker";
  activeView: CreatorView | WorkerView;
  children: React.ReactNode;
}

export function AppShell({ role, activeView, children }: AppShellProps) {
  const { account, signOut, mode, setMode } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [balance, setBalance] = useState<WorkerBalance | null>(null);

  const loadBalance = useCallback(async () => {
    if (role !== "worker") return;
    try {
      setBalance(await workerEndpoints.balance());
    } catch {
      // Non-fatal: the balance chip simply stays hidden.
    }
  }, [role]);

  const { withdraw, isWithdrawing } = useWithdrawal(loadBalance);

  useEffect(() => {
    void loadBalance();
    if (role !== "worker") return;

    const interval = setInterval(loadBalance, 30_000);
    return () => clearInterval(interval);
  }, [loadBalance, role]);

  const pending = balance?.pendingAmount ?? "0";
  const hasPending = pending !== "0";
  const needsWallet = Boolean(account && !account.walletAddress);

  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer />

      <header className="flex justify-between items-center gap-2 border-b px-3 py-2 fixed top-0 inset-x-0 bg-white z-50">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
          <span className="font-bold text-lg truncate">DojoPay</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {role === "worker" && hasPending && !needsWallet && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5">
              <span className="text-xs text-green-800 font-medium">
                {lamportsToSol(pending)} SOL
              </span>
              <button
                onClick={() => withdraw(pending)}
                disabled={isWithdrawing}
                className="text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 rounded px-2 py-1"
              >
                {isWithdrawing ? "Withdrawing…" : "Withdraw"}
              </button>
            </div>
          )}

          {/* One account covers both modes, so switching is a view toggle
              rather than a second sign-in. */}
          <button
            onClick={() => {
              const next = mode === "worker" ? "creator" : "worker";
              setMode(next);
              window.location.href = `/${next}/dashboard`;
            }}
            className="hidden sm:inline-flex text-xs rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
          >
            Switch to {mode === "worker" ? "creator" : "worker"}
          </button>

          <Link
            href="/settings"
            className="relative text-xs rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
          >
            Settings
            {/* A worker who cannot be paid should see that at all times, not
                only when they try to withdraw. */}
            {needsWallet && (
              <span
                className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500"
                aria-label="Action needed"
              />
            )}
          </Link>

          <button
            onClick={signOut}
            className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </header>

      {needsWallet && (
        <div className="fixed inset-x-0 top-14 z-40 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-900">
          Connect a Solana wallet to withdraw your earnings.{" "}
          <Link href="/settings" className="font-semibold underline">
            Set it up
          </Link>
        </div>
      )}

      <div className={needsWallet ? "flex-grow pt-24" : "flex-grow pt-16"}>
        <div className="flex flex-col lg:flex-row">
          {role === "worker" ? (
            <WorkerSidebar
              activeView={activeView as WorkerView}
              mobileMenuOpen={mobileMenuOpen}
              onMobileMenuClose={() => setMobileMenuOpen(false)}
            />
          ) : (
            <CreatorSidebar
              activeView={activeView as CreatorView}
              mobileMenuOpen={mobileMenuOpen}
              onMobileMenuClose={() => setMobileMenuOpen(false)}
            />
          )}
          <main className="flex-grow lg:ml-64 min-w-0">{children}</main>
        </div>
      </div>

      <ApplicationFooter />
    </div>
  );
}
