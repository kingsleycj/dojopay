"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, RotateCcw, TrendingDown, Users, Wallet } from "lucide-react";
import {
  ButtonLink,
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
import { creatorEndpoints, type CreatorEarnings } from "@/lib/api";
import { explorerTxUrl } from "@/lib/solana/config";

/**
 * Creator spending.
 *
 * Renamed from "earnings", which it never was — this page has always shown what
 * a creator *paid*. The distinction matters more now that budget can come back:
 * "committed" and "spent" are different numbers, and the old page conflated them
 * by summing `task.amount` and calling the result the bill.
 */
export function CreatorSpending() {
  const [data, setData] = useState<CreatorEarnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    creatorEndpoints
      .earnings()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page>
      <PageHeader
        eyebrow="Creator"
        title="Spending"
        description="What your tasks have actually cost, and who was paid."
        actions={
          <ButtonLink href="/creator/vault" variant="secondary">
            <Wallet className="h-4 w-4" />
            Vault
          </ButtonLink>
        }
      />

      <LiveRegion>{loading ? "Loading spending" : "Spending loaded"}</LiveRegion>

      {loading ? (
        <StatGridSkeleton columns={4} />
      ) : (
        <StatGrid columns={4}>
          <StatCard
            label="Total spent"
            value={<Sol lamports={data?.totalSpent ?? "0"} decimals={4} />}
            hint="Net of budget returned"
            tone="accent"
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <StatCard
            label="This month"
            value={<Sol lamports={data?.metrics.monthlySpent ?? "0"} decimals={4} />}
            hint="Since the 1st"
          />
          <StatCard
            label="Workers paid"
            value={data?.metrics.totalWorkers ?? 0}
            hint={`${data?.metrics.returningWorkers ?? 0} came back for more`}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Average per task"
            value={<Sol lamports={data?.averageTaskCost ?? "0"} decimals={4} />}
            hint={`Across ${data?.totalTasks ?? 0} tasks`}
          />
        </StatGrid>
      )}

      <Section
        title="Answers paid for"
        description="Each row is one worker's accepted answer."
        className="mt-8"
      >
        {loading ? (
          <ListSkeleton rows={6} />
        ) : !data?.earnings.length ? (
          <EmptyState
            title="Nothing paid out yet"
            description="Once workers start answering your tasks, every payment appears here."
            icon={<RotateCcw className="h-5 w-5" />}
            action={<ButtonLink href="/creator/create">Create a task</ButtonLink>}
          />
        ) : (
          <Surface className="divide-y divide-border">
            {data.earnings.slice(0, 50).map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/creator/task/${entry.taskId}`}
                    className="app-focus-ring block truncate rounded text-sm font-medium text-foreground hover:text-accent-mode"
                  >
                    {entry.taskTitle}
                  </Link>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {entry.workerAddress.length > 20
                      ? `${entry.workerAddress.slice(0, 6)}…${entry.workerAddress.slice(-4)}`
                      : entry.workerAddress}
                    {" · "}
                    {new Date(entry.date).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground">
                    <Sol lamports={entry.amount} decimals={6} />
                  </p>
                  {entry.status === "paid" && entry.transactionHash ? (
                    <a
                      href={explorerTxUrl(entry.transactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="app-focus-ring inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground hover:text-accent-mode"
                    >
                      withdrawn
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : (
                    <Pill>credited</Pill>
                  )}
                </div>
              </div>
            ))}
          </Surface>
        )}

        {data && data.earnings.length > 50 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the 50 most recent of {data.earnings.length}.
          </p>
        )}
      </Section>
    </Page>
  );
}
