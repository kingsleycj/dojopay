"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { showToast } from "@/components/Toast";
import { RoleGuard } from "@/lib/auth";
import { creatorEndpoints, type CreatorTask } from "@/lib/api";

function EditTaskForm({ taskId }: { taskId: number }) {
  const router = useRouter();
  const [task, setTask] = useState<CreatorTask | null>(null);
  const [title, setTitle] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setExpirationDate(new Date(date.getTime() - offsetMs).toISOString().slice(0, 16));
      }
    } catch (error: any) {
      showToast(error?.message ?? "Failed to load task", "error");
      router.push("/creator/tasks");
    } finally {
      setLoading(false);
    }
  }, [taskId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await creatorEndpoints.updateTask(taskId, {
        title,
        // Convert local wall-clock time back to an absolute instant.
        expirationDate: expirationDate ? new Date(expirationDate).toISOString() : null,
      });
      showToast("Task updated", "success");
      router.push(`/creator/task/${taskId}`);
    } catch (error: any) {
      showToast(error?.message ?? "Failed to update task", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-gray-200" />
          <div className="h-40 rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  const isEditable = task?.status === "OPEN";

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <button
        onClick={() => router.push(`/creator/task/${taskId}`)}
        className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-medium">Back to task</span>
      </button>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Edit task</h1>

        {!isEditable && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This task is {task?.status.toLowerCase()} and can no longer be edited.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-semibold text-gray-800">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!isEditable}
              required
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
            />
          </div>

          <div>
            <label htmlFor="expiration" className="mb-2 block text-sm font-semibold text-gray-800">
              Expires at
            </label>
            <input
              id="expiration"
              type="datetime-local"
              value={expirationDate}
              onChange={(event) => setExpirationDate(event.target.value)}
              disabled={!isEditable}
              min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
            />
            <p className="mt-2 text-sm text-gray-500">
              Leave blank for no expiry. Workers stop seeing the task once it expires.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/creator/task/${taskId}`)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isEditable || isSubmitting || !title.trim()}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EditTaskPage({ params }: { params: { taskId: string } }) {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator" activeView="tasks">
        <EditTaskForm taskId={Number(params.taskId)} />
      </AppShell>
    </RoleGuard>
  );
}
