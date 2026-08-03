"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { showToast } from "@/components/Toast";
import {
  Button,
  Callout,
  Field,
  Input,
  Page,
  PageHeader,
  Skeleton,
  Sol,
  Surface,
} from "@/components/ui-kit";
import { RoleGuard } from "@/lib/auth";
import { creatorEndpoints, type CreatorTask } from "@/lib/api";

/**
 * Editing a live task.
 *
 * Deliberately narrow: only the title and the closing time can change. Budget,
 * reward and slot count are all reserved against the creator's vault the moment
 * the task is published, and a worker who answered under one reward must not
 * find it changed underneath them. Reducing the scope is a refund — that is the
 * "Close & refund" action, not an edit.
 */
function EditTaskForm({ taskId }: { taskId: number }) {
  const router = useRouter();
  const [task, setTask] = useState<CreatorTask | null>(null);
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await creatorEndpoints.getTask(taskId);
      setTask(data);
      setTitle(data.title);

      if (data.expiresAt) {
        // `datetime-local` expects local time. Using `toISOString()` directly,
        // as the old page did, shifted the shown expiry by the timezone offset.
        const date = new Date(data.expiresAt);
        const offsetMs = date.getTimezoneOffset() * 60_000;
        setExpiresAt(new Date(date.getTime() - offsetMs).toISOString().slice(0, 16));
      }
    } catch (error: any) {
      showToast(error?.message ?? "Could not load that task", "error");
      router.push("/creator/tasks");
    } finally {
      setLoading(false);
    }
  }, [router, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await creatorEndpoints.updateTask(taskId, {
        title: title.trim(),
        expirationDate: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      showToast("Task updated", "success");
      router.push(`/creator/task/${taskId}`);
    } catch (error: any) {
      showToast(error?.message ?? "Could not save those changes", "error");
    } finally {
      setSaving(false);
    }
  };

  const closed = task && task.status !== "OPEN";

  return (
    <Page className="max-w-2xl">
      <Link
        href={`/creator/task/${taskId}`}
        className="app-focus-ring app-enter mb-4 inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to task
      </Link>

      <PageHeader
        eyebrow="Creator"
        title="Edit task"
        description="Change what workers see. The budget is already reserved and cannot be edited."
      />

      {loading ? (
        <Surface className="space-y-4 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </Surface>
      ) : closed ? (
        <Callout tone="warning" title="This task is closed">
          Only open tasks can be edited.
        </Callout>
      ) : (
        <Surface className="app-enter space-y-5 p-5 sm:p-6">
          <Field
            label="Task title"
            htmlFor="edit-title"
            hint="Workers see this above the images."
          >
            <Input
              id="edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </Field>

          <Field
            label="Closes at"
            htmlFor="edit-expiry"
            hint="Leave blank for no deadline. Unfilled slots return to your vault when a task closes."
          >
            <Input
              id="edit-expiry"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
            />
          </Field>

          {task && (
            <dl className="divide-y divide-border rounded-lg border border-border bg-muted/40 px-4 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="font-semibold">
                  <Sol lamports={task.amount} decimals={4} />
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">Each answer pays</dt>
                <dd className="font-semibold">
                  <Sol lamports={task.rewardPerSubmission} decimals={6} />
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">Answers</dt>
                <dd className="font-semibold tabular-nums">
                  {task.totalSubmissions} / {task.maxSubmissions}
                </dd>
              </div>
            </dl>
          )}

          <div className="flex gap-2">
            <Button onClick={save} disabled={!title.trim()} loading={saving}>
              Save changes
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/creator/task/${taskId}`)}>
              Cancel
            </Button>
          </div>
        </Surface>
      )}
    </Page>
  );
}

export default function EditTaskPage({ params }: { params: { taskId: string } }) {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator">
        <EditTaskForm taskId={Number(params.taskId)} />
      </AppShell>
    </RoleGuard>
  );
}
