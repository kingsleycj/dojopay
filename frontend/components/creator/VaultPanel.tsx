"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Lock,
  RotateCcw,
  Wallet,
} from "lucide-react";
import {
  Button,
  Callout,
  EmptyState,
  Field,
  Input,
  ListSkeleton,
  LiveRegion,
  Pill,
  Section,
  Sol,
  StatCard,
  StatGrid,
  StatGridSkeleton,
  Surface,
} from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { useVault } from "@/hooks/useVault";
import { vaultEndpoints, type VaultEntry, type VaultStatement } from "@/lib/api";
import { explorerTxUrl } from "@/lib/solana/config";
import { lamportsToSol } from "@/utils/convert";

/**
 * The creator's vault: balance, top-up, withdrawal, and the full statement.
 *
 * The three-way split — available, reserved, spent — is the point of the screen.
 * "Reserved" is the number creators most need and previously could not see at
 * all: SOL that is theirs, is not spendable, and will either become worker
 * earnings or come back. Showing only a single balance is how someone concludes
 * their money has vanished.
 */

const ENTRY_META: Record<
  VaultEntry["type"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DEPOSIT: { label: "Top-up", icon: ArrowDownLeft },
  WITHDRAWAL: { label: "Withdrawal", icon: ArrowUpRight },
  TASK_FUNDED: { label: "Task funded", icon: Lock },
  TASK_REFUND: { label: "Budget returned", icon: RotateCcw },
  REWARD_RELEASED: { label: "Reward paid", icon: ArrowUpRight },
};

export function VaultPanel() {
  const { vault, loading, busy, pendingSignature, deposit, retryCredit, withdraw, refresh } =
    useVault();

  const [topUp, setTopUp] = useState("0.5");
  const [statement, setStatement] = useState<VaultStatement | null>(null);
  const [page, setPage] = useState(1);
  const [statementLoading, setStatementLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setStatementLoading(true);

    vaultEndpoints
      .statement(page, 10)
      .then((result) => {
        if (!cancelled) setStatement(result);
      })
      .catch(() => {
        if (!cancelled) setStatement(null);
      })
      .finally(() => {
        if (!cancelled) setStatementLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `vault` is a dependency so the statement refreshes after a top-up or a
    // withdrawal changes the balance, without a manual reload.
  }, [page, vault?.updatedAt]);

  const canWithdraw = vault ? BigInt(vault.withdrawable) > BigInt(0) : false;

  return (
    <>
      {loading ? (
        <StatGridSkeleton columns={3} />
      ) : (
        <StatGrid columns={3}>
          <StatCard
            label="Available"
            value={<Sol lamports={vault?.available ?? "0"} decimals={4} />}
            hint="Ready to fund a task or withdraw"
            tone="accent"
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Reserved"
            value={<Sol lamports={vault?.reserved ?? "0"} decimals={4} />}
            hint="Committed to tasks still open"
            icon={<Lock className="h-4 w-4" />}
          />
          <StatCard
            label="Paid to workers"
            value={<Sol lamports={vault?.totalSpent ?? "0"} decimals={4} />}
            hint="Lifetime, across every task"
          />
        </StatGrid>
      )}

      <LiveRegion>{loading ? "Loading vault balance" : "Vault balance loaded"}</LiveRegion>

      {pendingSignature && (
        <div className="mt-6">
          <Callout
            tone="warning"
            title="A top-up needs crediting"
            action={
              <Button size="sm" onClick={retryCredit} loading={busy === "deposit"}>
                Retry crediting
              </Button>
            }
          >
            Your SOL reached the platform wallet but crediting it did not complete. It is safe —
            this only adds it to your balance, and running it twice cannot double-count.
          </Callout>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* --- Top up --------------------------------------------------- */}
        <Surface className="app-enter p-5">
          <h2 className="text-base font-semibold text-foreground">Top up</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Move SOL from your wallet into your vault. You fund tasks from here, so publishing one
            never needs another wallet approval.
          </p>

          <div className="mt-4 flex items-end gap-3">
            <Field label="Amount" htmlFor="topup-amount" className="flex-1">
              <div className="relative">
                <Input
                  id="topup-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={topUp}
                  onChange={(event) => setTopUp(event.target.value)}
                  className="pr-14"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  SOL
                </span>
              </div>
            </Field>
            <Button
              onClick={() => deposit(topUp)}
              loading={busy === "deposit"}
              className="mb-[1px] shrink-0"
            >
              Top up
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {["0.5", "1", "5"].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setTopUp(amount)}
                className="app-focus-ring rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-accent-mode hover:text-accent-mode"
              >
                {amount} SOL
              </button>
            ))}
          </div>

          {vault && (
            <p className="mt-3 text-xs text-muted-foreground">
              Minimum top-up {lamportsToSol(vault.minimumDeposit, 4)} SOL.
            </p>
          )}
        </Surface>

        {/* --- Withdraw ------------------------------------------------- */}
        <Surface className="app-enter p-5">
          <h2 className="text-base font-semibold text-foreground">Withdraw</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send your available balance back to your wallet. Reserved SOL stays put — it is
            promised to workers who have not answered yet.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Withdrawable now</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              <Sol lamports={vault?.withdrawable ?? "0"} decimals={6} />
            </p>
          </div>

          <Button
            onClick={withdraw}
            disabled={!canWithdraw}
            loading={busy === "withdraw"}
            className="mt-4 w-full"
            variant={canWithdraw ? "primary" : "secondary"}
          >
            {canWithdraw ? "Withdraw to wallet" : "Nothing to withdraw"}
          </Button>

          {vault && !canWithdraw && BigInt(vault.available) > BigInt(0) && (
            <p className="mt-2 text-xs text-muted-foreground">
              You have <Sol lamports={vault.available} decimals={9} /> available, below the{" "}
              {lamportsToSol(vault.minimumWithdrawal, 4)} SOL minimum. A transfer costs more in
              network fees than that is worth.
            </p>
          )}
        </Surface>
      </div>

      {/* --- Statement -------------------------------------------------- */}
      <Section
        title="Statement"
        description="Every movement in and out, newest first."
        className="mt-8"
      >
        {statementLoading ? (
          <ListSkeleton rows={5} />
        ) : !statement || statement.entries.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description="Top up your vault and every movement will be recorded on this page."
            icon={<Wallet className="h-5 w-5" />}
          />
        ) : (
          <>
            <Surface className="divide-y divide-border">
              {statement.entries.map((entry) => (
                <StatementRow key={entry.id} entry={entry} />
              ))}
            </Surface>

            {statement.pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {statement.pagination.currentPage} of {statement.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!statement.pagination.hasPreviousPage}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!statement.pagination.hasNextPage}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Section>
    </>
  );
}

function StatementRow({ entry }: { entry: VaultEntry }) {
  const meta = ENTRY_META[entry.type];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          entry.direction === "in"
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            : entry.direction === "out"
              ? "bg-muted text-muted-foreground"
              : "bg-accent-mode-soft text-accent-mode",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{meta.label}</p>
          {entry.status === "FAILED" && <Pill tone="danger">Failed</Pill>}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {entry.description ?? entry.taskTitle ?? "—"} ·{" "}
          {new Date(entry.createdAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-semibold",
            entry.direction === "in" && "text-emerald-600 dark:text-emerald-400",
            entry.status === "FAILED" && "line-through opacity-60",
          )}
        >
          <Sol
            lamports={entry.amount}
            decimals={6}
            sign={entry.direction === "in" ? "in" : entry.direction === "out" ? "out" : undefined}
          />
        </p>
        {entry.signature && (
          <a
            href={explorerTxUrl(entry.signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="app-focus-ring inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground hover:text-accent-mode"
          >
            {entry.signature.slice(0, 6)}…
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}
