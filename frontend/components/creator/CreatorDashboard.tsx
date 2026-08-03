"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Coins, Lock, PlusCircle, Users, Wallet } from "lucide-react";
import {
  ButtonLink,
  Callout,
  EmptyState,
  ListSkeleton,
  LiveRegion,
  Page,
  PageHeader,
  ProgressBar,
  Section,
  Sol,
  StatCard,
  StatGrid,
  StatGridSkeleton,
  Surface,
  TaskStatusPill,
} from "@/components/ui-kit";
import { creatorEndpoints, type CreatorDashboard as Dashboard } from "@/lib/api";

/**
 * Creator overview.
 *
 * Leads with the vault rather than with task counts. Under the old fixed-price
 * model the only question was how many tasks you had; now that a creator commits
 * an amount they choose, "what is committed and what is free" is the thing that
 * decides whether they can act at all.
 */
export function CreatorDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    creatorEndpoints
      .dashboard()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? "Could not load your dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const vault = data?.vault ?? null;
  const overview = data?.overview;

  return (
    <Page>
      <PageHeader
        eyebrow="Creator"
        title="Overview"
        description="What you have committed, what has been answered, and what is still open."
        actions={
          <>
            <ButtonLink href="/creator/vault" variant="secondary">
              <Wallet className="h-4 w-4" />
              Vault
            </ButtonLink>
            <ButtonLink href="/creator/create">
              <PlusCircle className="h-4 w-4" />
              New task
            </ButtonLink>
          </>
        }
      />

      {error && (
        <div className="mb-6">
          <Callout tone="danger" title="Could not load your dashboard">
            {error}
          </Callout>
        </div>
      )}

      <LiveRegion>{loading ? "Loading dashboard" : "Dashboard loaded"}</LiveRegion>

      {loading ? (
        <StatGridSkeleton columns={4} />
      ) : (
        <StatGrid columns={4}>
          <StatCard
            label="Vault available"
            value={<Sol lamports={vault?.available ?? "0"} decimals={4} />}
            hint="Ready to fund a task"
            tone="accent"
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Committed"
            value={<Sol lamports={vault?.reserved ?? "0"} decimals={4} />}
            hint="Held for open tasks"
            icon={<Lock className="h-4 w-4" />}
          />
          <StatCard
            label="Paid to workers"
            value={<Sol lamports={overview?.totalPayouts ?? "0"} decimals={4} />}
            hint={`${overview?.totalSubmissions ?? 0} answers`}
            icon={<Coins className="h-4 w-4" />}
          />
          <StatCard
            label="Returned to you"
            value={<Sol lamports={overview?.totalRefunded ?? "0"} decimals={4} />}
            hint="Budget from unfilled slots"
            icon={<Users className="h-4 w-4" />}
          />
        </StatGrid>
      )}

      {!loading && vault && BigInt(vault.available) === BigInt(0) && (
        <div className="mt-6">
          <Callout
            tone="info"
            title="Your vault is empty"
            action={
              <ButtonLink href="/creator/vault" size="sm">
                Top up
              </ButtonLink>
            }
          >
            Add SOL to your vault and you can publish tasks from it without another wallet
            approval each time.
          </Callout>
        </div>
      )}

      <Section
        title="Recent tasks"
        description="How full each one is, and what it is paying."
        className="mt-8"
        actions={
          <Link
            href="/creator/tasks"
            className="app-focus-ring rounded text-sm font-medium text-accent-mode hover:underline"
          >
            View all
          </Link>
        }
      >
        {loading ? (
          <ListSkeleton rows={4} />
        ) : !data?.recentActivity.length ? (
          <EmptyState
            title="No tasks yet"
            description="Publish your first task and workers can start answering within minutes."
            icon={<PlusCircle className="h-5 w-5" />}
            action={<ButtonLink href="/creator/create">Create a task</ButtonLink>}
          />
        ) : (
          <Surface className="divide-y divide-border">
            {data.recentActivity.map((task) => (
              <Link
                key={task.id}
                href={`/creator/task/${task.id}`}
                className="app-focus-ring block px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                      <TaskStatusPill status={task.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {task.submissions} of {task.maxSubmissions} answered ·{" "}
                      <Sol lamports={task.rewardPerSubmission} decimals={6} /> each
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">
                      <Sol lamports={task.amount} decimals={4} />
                    </p>
                    <p className="text-xs text-muted-foreground">budget</p>
                  </div>
                </div>
                <ProgressBar
                  value={task.submissions}
                  max={task.maxSubmissions}
                  className="mt-3"
                  label={`${task.submissions} of ${task.maxSubmissions} answers received`}
                />
              </Link>
            ))}
          </Surface>
        )}
      </Section>
    </Page>
  );
}
