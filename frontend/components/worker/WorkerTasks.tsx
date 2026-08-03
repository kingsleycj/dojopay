"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Coins, Inbox } from "lucide-react";
import {
  Button,
  ButtonLink,
  EmptyState,
  ListSkeleton,
  LiveRegion,
  Page,
  PageHeader,
  Pill,
  ProgressBar,
  Section,
  Sol,
  Surface,
} from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { workerEndpoints, type WorkerTask } from "@/lib/api";
import { TaskRunner } from "./TaskRunner";

/**
 * The available-work queue.
 *
 * New in this rebuild: workers used to be handed one task at a time with no view
 * of what else was there. That was defensible when every task paid the same
 * 0.001 SOL — it is not now that creators set their own rewards and one task can
 * be worth ten times another. Being able to choose is the difference between a
 * queue and a marketplace.
 */
export function WorkerTasks() {
  const [tasks, setTasks] = useState<WorkerTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<WorkerTask | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await workerEndpoints.availableTasks();
      setTasks(result);
      // Keep the open task in view only while it is still answerable.
      setActive((current) =>
        current && result.some((task) => task.id === current.id) ? current : null,
      );
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalValue =
    tasks?.reduce((sum, task) => sum + BigInt(task.rewardLamports), BigInt(0)) ?? BigInt(0);

  return (
    <Page>
      <PageHeader
        eyebrow="Worker"
        title="Available work"
        description={
          loading
            ? undefined
            : `${tasks?.length ?? 0} ${tasks?.length === 1 ? "task" : "tasks"} waiting for an answer`
        }
        actions={
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        }
      />

      {!loading && tasks && tasks.length > 0 && (
        <p className="app-enter -mt-4 mb-6 text-sm text-muted-foreground">
          Answering everything here would earn{" "}
          <Sol lamports={totalValue.toString()} decimals={4} className="font-semibold text-foreground" />
          . Best-paying first.
        </p>
      )}

      <LiveRegion>{loading ? "Loading tasks" : `${tasks?.length ?? 0} tasks available`}</LiveRegion>

      {active && (
        <Section
          title="Answering now"
          actions={
            <Button size="sm" variant="ghost" onClick={() => setActive(null)}>
              Back to list
            </Button>
          }
        >
          <TaskRunner initialTask={active} onEarned={load} />
        </Section>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : !tasks?.length ? (
        <EmptyState
          title="Nothing available right now"
          description="You have answered everything that is open. New work appears as creators publish it."
          icon={<Inbox className="h-5 w-5" />}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={load}>
                Refresh
              </Button>
              <ButtonLink href="/worker/earnings">View earnings</ButtonLink>
            </div>
          }
        />
      ) : (
        <div className="app-stagger space-y-3">
          {tasks.map((task) => (
            <Surface
              key={task.id}
              interactive
              className={cn(
                "p-4",
                active?.id === task.id && "border-accent-mode ring-1 ring-accent-mode",
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {/* A glance at what the task is, before committing to opening it. */}
                <div className="flex shrink-0 -space-x-2">
                  {task.options.slice(0, 3).map((option) => (
                    <img
                      key={option.id}
                      src={option.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 rounded-lg border-2 border-card bg-muted object-cover"
                    />
                  ))}
                  {task.options.length > 3 && (
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-card bg-muted text-xs font-semibold text-muted-foreground">
                      +{task.options.length - 3}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Pill tone="positive">
                      <Coins className="h-3 w-3" />
                      <Sol lamports={task.rewardLamports} decimals={6} />
                    </Pill>
                    <Pill>{task.spotsRemaining} left</Pill>
                    {task.expiresAt && (
                      <Pill tone="warning">
                        <Clock className="h-3 w-3" />
                        {new Date(task.expiresAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </Pill>
                    )}
                  </div>
                  <ProgressBar
                    value={task.totalSubmissions}
                    max={task.maxSubmissions}
                    className="mt-2.5"
                    label={`${task.totalSubmissions} of ${task.maxSubmissions} answered`}
                  />
                </div>

                <Button
                  size="sm"
                  className="shrink-0 sm:w-28"
                  onClick={() => {
                    setActive(task);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {active?.id === task.id ? "Open" : "Answer"}
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </Page>
  );
}
