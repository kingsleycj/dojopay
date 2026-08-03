"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Crown, Lock, Pencil, Users } from "lucide-react";
import { ShareButton } from "@/components/shared/ShareButton";
import { showToast } from "@/components/Toast";
import {
  Button,
  ButtonLink,
  Callout,
  EmptyState,
  ListSkeleton,
  LiveRegion,
  Page,
  PageHeader,
  ProgressBar,
  Section,
  Skeleton,
  Sol,
  StatCard,
  StatGrid,
  StatGridSkeleton,
  Surface,
  TaskStatusPill,
} from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { creatorEndpoints, type TaskResults } from "@/lib/api";

/**
 * A creator's view of one task.
 *
 * The results are the point, so the winning option is called out rather than
 * left for the reader to work out from a row of counts. Everything else on the
 * page answers "where did my budget go" — spent, still held, already returned —
 * which under the fixed-price model there was no need to ask.
 */
export function TaskDetail({ taskId }: { taskId: number }) {
  const router = useRouter();
  const [data, setData] = useState<TaskResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await creatorEndpoints.getTaskResults(taskId));
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Could not load this task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const details = data?.taskDetails;

  const options = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.result).map(([id, value]) => ({
      id: Number(id),
      count: value.count,
      imageUrl: value.option.imageUrl,
    }));
    return entries.sort((a, b) => b.count - a.count);
  }, [data]);

  const topCount = options[0]?.count ?? 0;
  // Only a genuine, unshared lead is a "winner". A tie is information too.
  const hasWinner = topCount > 0 && options.filter((option) => option.count === topCount).length === 1;

  const cancel = useCallback(async () => {
    if (!details) return;
    const remaining = details.spotsRemaining;

    const confirmed = window.confirm(
      `Close "${details.title}" now?\n\n` +
        `${remaining} unanswered ${remaining === 1 ? "slot" : "slots"} will be released back ` +
        `to your vault. Answers already given stay paid.`,
    );
    if (!confirmed) return;

    setCancelling(true);
    try {
      const result = await creatorEndpoints.cancelTask(taskId);
      showToast(result.message, "success");
      await load();
    } catch (err: any) {
      showToast(err?.message ?? "Could not close that task", "error");
    } finally {
      setCancelling(false);
    }
  }, [details, load, taskId]);

  if (error) {
    return (
      <Page>
        <Callout tone="danger" title="Could not load this task" action={
          <Button size="sm" variant="secondary" onClick={() => router.push("/creator/tasks")}>
            Back to tasks
          </Button>
        }>
          {error}
        </Callout>
      </Page>
    );
  }

  return (
    <Page>
      <Link
        href="/creator/tasks"
        className="app-focus-ring app-enter mb-4 inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All tasks
      </Link>

      {loading ? (
        <Skeleton className="mb-6 h-9 w-2/3" />
      ) : (
        <PageHeader
          eyebrow="Task"
          title={details?.title ?? ""}
          description={
            details
              ? `Created ${new Date(details.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : undefined
          }
          actions={
            details ? (
              <>
                <TaskStatusPill status={details.status} />
                <ShareButton taskId={taskId} title={details.title} />
                {details.status === "OPEN" && (
                  <>
                    <ButtonLink
                      href={`/creator/task/${taskId}/edit`}
                      size="md"
                      variant="secondary"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </ButtonLink>
                    <Button variant="danger" onClick={cancel} loading={cancelling}>
                      Close &amp; refund
                    </Button>
                  </>
                )}
              </>
            ) : null
          }
        />
      )}

      <LiveRegion>{loading ? "Loading task" : "Task loaded"}</LiveRegion>

      {loading ? (
        <StatGridSkeleton columns={4} />
      ) : details ? (
        <StatGrid columns={4}>
          <StatCard
            label="Answers"
            value={`${details.totalSubmissions} / ${details.maxSubmissions}`}
            hint={`${details.spotsRemaining} still open`}
            tone="accent"
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Each answer pays"
            value={<Sol lamports={details.rewardPerSubmission} decimals={6} />}
            hint="Credited the moment it is accepted"
          />
          <StatCard
            label="Spent so far"
            value={<Sol lamports={details.spent} decimals={4} />}
            hint={<>of <Sol lamports={details.amount} decimals={4} /> committed</>}
          />
          <StatCard
            label={details.status === "OPEN" ? "Still held" : "Returned to vault"}
            value={
              <Sol
                lamports={
                  details.status === "OPEN"
                    ? (
                        BigInt(details.rewardPerSubmission) * BigInt(details.spotsRemaining)
                      ).toString()
                    : details.refundedAmount
                }
                decimals={4}
              />
            }
            hint={details.status === "OPEN" ? "Released if it closes unfilled" : "Unfilled slots"}
            icon={<Lock className="h-4 w-4" />}
          />
        </StatGrid>
      ) : null}

      {details && (
        <div className="mt-4">
          <ProgressBar
            value={details.totalSubmissions}
            max={details.maxSubmissions}
            label={`${details.totalSubmissions} of ${details.maxSubmissions} answers received`}
          />
        </div>
      )}

      <Section title="Results" description="Ordered by how many workers chose each option." className="mt-8">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : options.length === 0 ? (
          <EmptyState title="No options" description="This task has no options to show." />
        ) : (
          <div className="app-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((option, index) => {
              const isWinner = hasWinner && index === 0;
              const share =
                details && details.totalSubmissions > 0
                  ? Math.round((option.count / details.totalSubmissions) * 100)
                  : 0;

              return (
                <Surface
                  key={option.id}
                  className={cn(
                    "overflow-hidden",
                    isWinner && "border-accent-mode ring-1 ring-accent-mode",
                  )}
                >
                  <div className="relative">
                    <img
                      src={option.imageUrl}
                      alt={`Option ${index + 1}`}
                      loading="lazy"
                      className="aspect-video w-full bg-muted object-cover"
                    />
                    {isWinner && (
                      <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-accent-mode px-2.5 py-1 text-[0.6875rem] font-semibold text-white">
                        <Crown className="h-3 w-3" />
                        Most chosen
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        {option.count} {option.count === 1 ? "vote" : "votes"}
                      </span>
                      <span className="text-xs text-muted-foreground">{share}%</span>
                    </div>
                    <ProgressBar
                      value={option.count}
                      max={Math.max(1, topCount)}
                      className="mt-2"
                      label={`${option.count} votes`}
                    />
                  </div>
                </Surface>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Who answered" description="Newest first.">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : !data?.submissions.length ? (
          <EmptyState
            title="No answers yet"
            description="Share the task link to reach workers faster."
            icon={<Users className="h-5 w-5" />}
          />
        ) : (
          <Surface className="divide-y divide-border">
            {data.submissions.slice(0, 50).map((submission) => (
              <div
                key={`${submission.workerId}-${submission.submittedAt}`}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-foreground">
                    {submission.workerAddress.length > 20
                      ? `${submission.workerAddress.slice(0, 6)}…${submission.workerAddress.slice(-4)}`
                      : submission.workerAddress}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(submission.submittedAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  <Sol lamports={submission.amount} decimals={6} />
                </p>
              </div>
            ))}
          </Surface>
        )}
      </Section>
    </Page>
  );
}
