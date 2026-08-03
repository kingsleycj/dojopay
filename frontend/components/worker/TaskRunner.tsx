"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Coins, Inbox, Sparkles } from "lucide-react";
import { showToast } from "@/components/Toast";
import {
  Button,
  ButtonLink,
  EmptyState,
  LiveRegion,
  Pill,
  ProgressBar,
  Skeleton,
  Sol,
  Surface,
} from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { workerEndpoints, type WorkerTask } from "@/lib/api";

/**
 * The labelling experience.
 *
 * This is the screen a worker spends all their time on, so it optimises for one
 * thing: answering many tasks quickly without the page moving underneath you.
 *
 * The submit call returns the next task, so there is no fetch-after-submit
 * round-trip between answers. The selected option is held through the submit and
 * only cleared once the next task is actually mounted — clearing it immediately
 * makes the card flicker back to "nothing selected" for a frame, which reads as
 * the click having been lost.
 */
export function TaskRunner({
  initialTask,
  onEarned,
}: {
  initialTask?: WorkerTask | null;
  onEarned?: () => void;
}) {
  const [task, setTask] = useState<WorkerTask | null>(initialTask ?? null);
  const [loading, setLoading] = useState(initialTask === undefined);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justEarned, setJustEarned] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  const loadNext = useCallback(async () => {
    setLoading(true);
    try {
      setTask(await workerEndpoints.nextTask());
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTask === undefined) void loadNext();
  }, [initialTask, loadNext]);

  const submit = useCallback(async () => {
    if (!task || selected === null || submitting) return;

    setSubmitting(true);
    try {
      const result = await workerEndpoints.submit(task.id, selected);

      setJustEarned(result.amount);
      setCompletedCount((count) => count + 1);
      onEarned?.();

      // The next task rides along on the response, so answering back-to-back
      // costs one request rather than two.
      setTask(result.nextTask);
      setSelected(null);

      // Long enough to register the reward, short enough not to stall someone
      // working through a queue.
      window.setTimeout(() => setJustEarned(null), 2200);
    } catch (error: any) {
      // Someone else took the last slot, or this task closed while it was open
      // on screen. Neither is the worker's fault, so move them on rather than
      // leaving them staring at a task they cannot answer.
      if (["TASK_FULL", "TASK_CLOSED", "TASK_EXPIRED", "DUPLICATE_SUBMISSION"].includes(error?.code)) {
        showToast(error.message ?? "That task is no longer available", "info");
        setSelected(null);
        await loadNext();
        return;
      }

      showToast(error?.message ?? "Could not submit your answer", "error");
    } finally {
      setSubmitting(false);
    }
  }, [loadNext, onEarned, selected, submitting, task]);

  if (loading) return <TaskRunnerSkeleton />;

  if (!task) {
    return (
      <EmptyState
        title={completedCount > 0 ? "That is everything for now" : "No tasks available"}
        description={
          completedCount > 0
            ? `You answered ${completedCount} ${completedCount === 1 ? "task" : "tasks"} this session. Check back shortly — new work appears as creators publish it.`
            : "New work appears as creators publish it. Check back shortly."
        }
        icon={<Inbox className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadNext}>
              Refresh
            </Button>
            <ButtonLink href="/worker/earnings">View earnings</ButtonLink>
          </div>
        }
      />
    );
  }

  return (
    <div className="relative">
      {/*
        Reward confirmation. Rendered over the card rather than replacing it, so
        the layout does not shift between answers.
      */}
      {justEarned && (
        <div
          className="app-enter pointer-events-none absolute -top-3 right-0 z-10 flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-elevated"
          role="status"
        >
          <Check className="h-3.5 w-3.5" />
          <span>
            +<Sol lamports={justEarned} decimals={6} /> earned
          </span>
        </div>
      )}

      <Surface className="app-enter overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{task.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone="positive">
                <Coins className="h-3 w-3" />
                <Sol lamports={task.rewardLamports} decimals={6} /> for this answer
              </Pill>
              <Pill>
                {task.spotsRemaining} {task.spotsRemaining === 1 ? "spot" : "spots"} left
              </Pill>
              {task.expiresAt && (
                <Pill tone="warning">
                  <Clock className="h-3 w-3" />
                  Closes{" "}
                  {new Date(task.expiresAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </Pill>
              )}
            </div>
          </div>

          {completedCount > 0 && (
            <div className="text-right">
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                This session
              </p>
              <p className="text-lg font-bold tabular-nums text-accent-mode">{completedCount}</p>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <p className="mb-3 text-sm text-muted-foreground">
            Pick the option you think is best. There is no wrong answer — creators want your
            judgement.
          </p>

          <div
            className={cn(
              "grid gap-3",
              task.options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3",
            )}
            role="radiogroup"
            aria-label="Task options"
          >
            {task.options.map((option, index) => {
              const isSelected = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={submitting}
                  onClick={() => setSelected(option.id)}
                  className={cn(
                    "app-press app-focus-ring group relative overflow-hidden rounded-xl border-2 transition-colors",
                    isSelected
                      ? "border-accent-mode ring-2 ring-accent-mode ring-offset-2 ring-offset-background"
                      : "border-border hover:border-accent-mode/60",
                    submitting && "cursor-wait opacity-70",
                  )}
                >
                  <img
                    src={option.imageUrl}
                    alt={`Option ${index + 1}`}
                    loading="lazy"
                    className="aspect-square w-full bg-muted object-cover"
                  />

                  <span
                    className={cn(
                      "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[0.6875rem] font-bold transition-colors",
                      isSelected
                        ? "bg-accent-mode text-white"
                        : "bg-background/80 text-foreground backdrop-blur",
                    )}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ProgressBar
              value={task.totalSubmissions}
              max={task.maxSubmissions}
              className="flex-1"
              label={`${task.totalSubmissions} of ${task.maxSubmissions} answers received`}
            />
            <Button
              onClick={submit}
              disabled={selected === null}
              loading={submitting}
              size="lg"
              className="sm:w-48"
            >
              {submitting ? "Submitting…" : selected === null ? "Pick an option" : "Submit answer"}
              {!submitting && selected !== null && <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Surface>

      <LiveRegion>
        {justEarned ? "Answer accepted, reward credited" : `Task: ${task.title}`}
      </LiveRegion>
    </div>
  );
}

export function TaskRunnerSkeleton() {
  return (
    <Surface className="overflow-hidden">
      <div className="border-b border-border p-4 sm:p-5">
        <Skeleton className="h-5 w-2/3" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-5 h-12 w-full rounded-lg" />
      </div>
    </Surface>
  );
}
