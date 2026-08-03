"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Clock, Coins, ExternalLink, Wallet } from "lucide-react";
import {
  Button,
  ButtonLink,
  Callout,
  EmptyState,
  ListSkeleton,
  LiveRegion,
  Page,
  PageHeader,
  Pill,
  Section,
  Sol,
  StatCard,
  StatGrid,
  StatGridSkeleton,
  Surface,
} from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { useWithdrawal } from "@/hooks/useWithdrawal";
import { useAuth } from "@/lib/auth";
import { workerEndpoints, type WorkerEarnings as Earnings } from "@/lib/api";
import { explorerTxUrl } from "@/lib/solana/config";
import { lamportsToSol } from "@/utils/convert";

/**
 * Worker earnings.
 *
 * A ledger, not a summary: every answer credited and every withdrawal made, in
 * one list. The withdrawal button here and the one in the app bar share the same
 * hook — the earnings page used to POST without a signature and therefore always
 * failed while the app-bar path worked, which is exactly the kind of divergence
 * one shared hook prevents.
 */
export function WorkerEarnings() {
  const { account } = useAuth();
  const [data, setData] = useState<Earnings | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await workerEndpoints.earnings(page, 10));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const { withdraw, isWithdrawing } = useWithdrawal(load);

  const pending = data?.metrics.pendingEarnings ?? "0";
  const hasPending = BigInt(pending) > BigInt(0);
  const needsWallet = Boolean(account && !account.walletAddress);

  return (
    <Page>
      <PageHeader
        eyebrow="Worker"
        title="Earnings"
        description="Everything you have been credited, and everything you have withdrawn."
        actions={
          hasPending && !needsWallet ? (
            <Button onClick={() => withdraw(pending)} loading={isWithdrawing}>
              <ArrowUpRight className="h-4 w-4" />
              Withdraw {lamportsToSol(pending, 4)} SOL
            </Button>
          ) : null
        }
      />

      <LiveRegion>{loading ? "Loading earnings" : "Earnings loaded"}</LiveRegion>

      {loading ? (
        <StatGridSkeleton columns={3} />
      ) : (
        <StatGrid columns={3}>
          <StatCard
            label="Ready to withdraw"
            value={<Sol lamports={pending} decimals={6} />}
            hint={needsWallet ? "Connect a wallet first" : "Credited, not yet paid out"}
            tone="accent"
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Withdrawn"
            value={<Sol lamports={data?.metrics.totalWithdrawn ?? "0"} decimals={6} />}
            hint="Confirmed on chain"
            icon={<ArrowUpRight className="h-4 w-4" />}
          />
          <StatCard
            label="Lifetime earned"
            value={
              <Sol
                lamports={(
                  BigInt(pending) + BigInt(data?.metrics.totalWithdrawn ?? "0")
                ).toString()}
                decimals={6}
              />
            }
            hint="Pending plus withdrawn"
            icon={<Coins className="h-4 w-4" />}
          />
        </StatGrid>
      )}

      {needsWallet && hasPending && (
        <div className="mt-6">
          <Callout
            tone="warning"
            title="Connect a wallet to withdraw"
            action={
              <ButtonLink href="/settings" size="sm">
                Go to settings
              </ButtonLink>
            }
          >
            Your <Sol lamports={pending} decimals={6} className="font-semibold" /> is safely
            credited. It just needs somewhere to be sent.
          </Callout>
        </div>
      )}

      <Section title="Activity" description="Newest first." className="mt-8">
        {loading ? (
          <ListSkeleton rows={6} />
        ) : !data?.earnings.length ? (
          <EmptyState
            title="No earnings yet"
            description="Answer a task and it will be credited here the moment it is accepted."
            icon={<Coins className="h-5 w-5" />}
            action={<ButtonLink href="/worker/tasks">Find work</ButtonLink>}
          />
        ) : (
          <>
            <Surface className="divide-y divide-border">
              {data.earnings.map((entry) => {
                const isWithdrawal = entry.status === "withdrawn";
                return (
                  <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        isWithdrawal
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
                      )}
                    >
                      {isWithdrawal ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <Coins className="h-4 w-4" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {isWithdrawal ? "Withdrawn to wallet" : (entry.taskTitle ?? "Task answered")}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(entry.date).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          !isWithdrawal && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        <Sol
                          lamports={entry.amount}
                          decimals={6}
                          sign={isWithdrawal ? "out" : "in"}
                        />
                      </p>
                      {entry.transactionHash ? (
                        <a
                          href={explorerTxUrl(entry.transactionHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="app-focus-ring inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground hover:text-accent-mode"
                        >
                          {entry.transactionHash.slice(0, 6)}…
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <Pill>Pending withdrawal</Pill>
                      )}
                    </div>
                  </div>
                );
              })}
            </Surface>

            {data.pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {data.pagination.currentPage} of {data.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!data.pagination.hasPreviousPage}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!data.pagination.hasNextPage}
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
    </Page>
  );
}
