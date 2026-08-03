"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, PlusCircle } from "lucide-react";
import { showToast } from "@/components/Toast";
import {
  Button,
  ButtonLink,
  EmptyState,
  ListSkeleton,
  LiveRegion,
  Page,
  PageHeader,
  ProgressBar,
  Sol,
  Surface,
  TaskStatusPill,
} from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { creatorEndpoints, type CreatorTask } from "@/lib/api";

/**
 * The creator's task list.
 *
 * Every row answers the three questions a creator actually has: how full is it,
 * what has it cost me so far, and how much is still tied up. The old list showed
 * a title, a status and a total — none of which told you whether money was
 * moving.
 */

const FILTERS = [
  { id: "all", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "COMPLETED", label: "Filled" },
  { id: "closed", label: "Closed" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function CreatorTasks() {
  const [tasks, setTasks] = useState<CreatorTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("all");
  const [cancelling, setCancelling] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await creatorEndpoints.listTasks());
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!tasks) return [];
    if (filter === "all") return tasks;
    if (filter === "closed") {
      return tasks.filter((task) => !["OPEN", "COMPLETED"].includes(task.status));
    }
    return tasks.filter((task) => task.status === filter);
  }, [filter, tasks]);

  const counts = useMemo(() => {
    const open = tasks?.filter((task) => task.status === "OPEN").length ?? 0;
    return { open, total: tasks?.length ?? 0 };
  }, [tasks]);

  const cancel = useCallback(
    async (task: CreatorTask) => {
      const remaining = task.spotsRemaining;
      const confirmed = window.confirm(
        `Close "${task.title}" now?\n\n` +
          `${remaining} unanswered ${remaining === 1 ? "slot" : "slots"} will be released back ` +
          `to your vault. Answers already given stay paid.`,
      );
      if (!confirmed) return;

      setCancelling(task.id);
      try {
        const result = await creatorEndpoints.cancelTask(task.id);
        showToast(result.message, "success");
        await load();
      } catch (error: any) {
        showToast(error?.message ?? "Could not close that task", "error");
      } finally {
        setCancelling(null);
      }
    },
    [load],
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Creator"
        title="My tasks"
        description={
          loading ? undefined : `${counts.total} total · ${counts.open} still accepting answers`
        }
        actions={
          <ButtonLink href="/creator/create">
            <PlusCircle className="h-4 w-4" />
            New task
          </ButtonLink>
        }
      />

      <div className="app-enter mb-4 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setFilter(entry.id)}
            aria-pressed={filter === entry.id}
            className={cn(
              "app-focus-ring rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === entry.id
                ? "border-transparent bg-accent-mode text-white"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <LiveRegion>
        {loading ? "Loading tasks" : `${filtered.length} tasks shown`}
      </LiveRegion>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No tasks yet" : "Nothing matches that filter"}
          description={
            filter === "all"
              ? "Publish a task and workers can start answering within minutes."
              : "Try a different filter to see your other tasks."
          }
          icon={<ListChecks className="h-5 w-5" />}
          action={filter === "all" ? <ButtonLink href="/creator/create">Create a task</ButtonLink> : null}
        />
      ) : (
        <div className="app-stagger space-y-3">
          {filtered.map((task) => (
            <Surface key={task.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/creator/task/${task.id}`}
                      className="app-focus-ring rounded text-sm font-semibold text-foreground hover:text-accent-mode"
                    >
                      {task.title}
                    </Link>
                    <TaskStatusPill status={task.status} />
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Created{" "}
                    {new Date(task.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {task.expiresAt &&
                      ` · closes ${new Date(task.expiresAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}`}
                  </p>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">
                        {task.totalSubmissions} of {task.maxSubmissions} answered
                      </span>
                      <span className="font-medium text-foreground">
                        <Sol lamports={task.rewardPerSubmission} decimals={6} /> each
                      </span>
                    </div>
                    <ProgressBar
                      value={task.totalSubmissions}
                      max={task.maxSubmissions}
                      label={`${task.totalSubmissions} of ${task.maxSubmissions} answers received`}
                    />
                  </div>
                </div>

                <div className="grid shrink-0 grid-cols-3 gap-4 border-t border-border pt-3 sm:w-56 sm:grid-cols-1 sm:gap-1.5 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <Figure label="Budget" value={<Sol lamports={task.amount} decimals={4} />} />
                  <Figure label="Spent" value={<Sol lamports={task.spent} decimals={4} />} />
                  {/*
                    "Still held" is the number that made the old list misleading:
                    a half-filled task looks expensive until you can see that the
                    rest is reserved and will come back.
                  */}
                  <Figure
                    label={task.status === "OPEN" ? "Still held" : "Returned"}
                    value={
                      <Sol
                        lamports={
                          task.status === "OPEN" ? task.reservedRemaining : task.refundedAmount
                        }
                        decimals={4}
                      />
                    }
                  />
                </div>
              </div>

              {task.status === "OPEN" && (
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                  <ButtonLink href={`/creator/task/${task.id}`} size="sm" variant="secondary">
                    View results
                  </ButtonLink>
                  <ButtonLink href={`/creator/task/${task.id}/edit`} size="sm" variant="ghost">
                    Edit
                  </ButtonLink>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={cancelling === task.id}
                    onClick={() => cancel(task)}
                  >
                    Close &amp; refund
                  </Button>
                </div>
              )}
            </Surface>
          ))}
        </div>
      )}
    </Page>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
      <span className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
