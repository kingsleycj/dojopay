"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Coins, Inbox, Wallet } from "lucide-react";
import {
  ButtonLink,
  Callout,
  LiveRegion,
  Page,
  PageHeader,
  Section,
  Sol,
  StatCard,
  StatGrid,
  StatGridSkeleton,
  Surface,
} from "@/components/ui-kit";
import { useAuth } from "@/lib/auth";
import { workerEndpoints, type WorkerDashboard as Dashboard } from "@/lib/api";
import { TaskRunner, TaskRunnerSkeleton } from "./TaskRunner";

/**
 * Worker overview.
 *
 * Puts the next task on the dashboard rather than behind a link. The measure of
 * this screen is how fast someone can go from landing on it to earning, and a
 * separate "start working" click was pure friction.
 */
export function WorkerDashboard() {
  const { account } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await workerEndpoints.dashboard());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = data?.metrics;
  const needsWallet = Boolean(account && !account.walletAddress);
  const hasPending = metrics ? BigInt(metrics.pendingEarnings) > BigInt(0) : false;

  return (
    <Page>
      <PageHeader
        eyebrow="Worker"
        title={greeting(account?.displayName)}
        description="Answer a task, get paid the moment it is accepted."
        actions={
          <ButtonLink href="/worker/earnings" variant="secondary">
            <Coins className="h-4 w-4" />
            Earnings
          </ButtonLink>
        }
      />

      <LiveRegion>{loading ? "Loading dashboard" : "Dashboard loaded"}</LiveRegion>

      {loading ? (
        <StatGridSkeleton columns={4} />
      ) : (
        <StatGrid columns={4}>
          <StatCard
            label="Ready to withdraw"
            value={<Sol lamports={metrics?.pendingEarnings ?? "0"} decimals={6} />}
            hint={needsWallet ? "Connect a wallet first" : "Earned, not yet paid out"}
            tone="accent"
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Tasks available"
            value={metrics?.availableTasks ?? 0}
            hint="Waiting for an answer"
            icon={<Inbox className="h-4 w-4" />}
          />
          <StatCard
            label="Queue value"
            value={<Sol lamports={metrics?.availableValue ?? "0"} decimals={4} />}
            hint="If you answered all of them"
          />
          <StatCard
            label="Answers given"
            value={metrics?.completedTasks ?? 0}
            hint="All time"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </StatGrid>
      )}

      {needsWallet && hasPending && (
        <div className="mt-6">
          <Callout
            tone="warning"
            title="Your earnings need somewhere to go"
            action={
              <ButtonLink href="/settings" size="sm">
                Connect a wallet
              </ButtonLink>
            }
          >
            You have earned{" "}
            <Sol lamports={metrics?.pendingEarnings ?? "0"} decimals={6} className="font-semibold" />{" "}
            and it is safely credited to your account. Link a Solana wallet to withdraw it.
          </Callout>
        </div>
      )}

      <Section
        title="Next task"
        description="Answer it and the next one loads straight away."
        className="mt-8"
        actions={
          <Link
            href="/worker/tasks"
            className="app-focus-ring rounded text-sm font-medium text-accent-mode hover:underline"
          >
            Browse all
          </Link>
        }
      >
        {loading ? (
          <TaskRunnerSkeleton />
        ) : (
          <TaskRunner initialTask={data?.nextTask ?? null} onEarned={load} />
        )}
      </Section>

      {!loading && data?.recentTasks.length ? (
        <Section title="Recently answered">
          <Surface className="divide-y divide-border">
            {data.recentTasks.map((entry) => (
              <div key={`${entry.id}-${entry.createdAt}`} className="flex items-center gap-4 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <Sol lamports={entry.amount} decimals={6} sign="in" />
                </p>
              </div>
            ))}
          </Surface>
        </Section>
      ) : null}
    </Page>
  );
}

/** Time-of-day greeting. Falls back to something neutral when there is no name. */
function greeting(name?: string | null): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}
