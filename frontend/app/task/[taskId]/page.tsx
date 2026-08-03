import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTaskView } from "@/components/shared/PublicTaskView";
import { BACKEND_URL } from "@/lib/api/client";
import type { PublicTask } from "@/lib/api/types";

/**
 * Public share landing page.
 *
 * Rendered on the server with no session, so a link pasted into a group chat
 * shows the actual task — title, reward, spots left — before asking for
 * anything. Previously the only task routes required a token, so a shared link
 * bounced a new visitor straight to a wallet prompt with no explanation.
 */

async function fetchTask(taskId: string): Promise<PublicTask | null> {
  if (!/^\d+$/.test(taskId)) return null;

  try {
    const response = await fetch(`${BACKEND_URL}/v1/public/task/${taskId}`, {
      // Share links arrive in bursts; a short revalidate keeps the spots-left
      // count fresh without hammering the API.
      next: { revalidate: 30 },
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicTask;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { taskId: string };
}): Promise<Metadata> {
  const task = await fetchTask(params.taskId);

  if (!task) {
    return { title: "Task not found — DojoPay" };
  }

  const reward = (Number(task.rewardLamports) / 1_000_000_000).toFixed(4).replace(/\.?0+$/, "");
  const title = `${task.title} — earn ${reward} SOL on DojoPay`;
  const description = task.isOpen
    ? `${task.spotsRemaining} of ${task.maxSubmissions} spots left. Pick an option, get paid in SOL.`
    : "This task is closed, but there are others waiting on DojoPay.";

  // Unfurls with the task's own image when shared.
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: task.previewImages.slice(0, 1),
      type: "website",
    },
    twitter: {
      card: task.previewImages.length ? "summary_large_image" : "summary",
      title,
      description,
      images: task.previewImages.slice(0, 1),
    },
  };
}

export default async function PublicTaskPage({
  params,
}: {
  params: { taskId: string };
}) {
  const task = await fetchTask(params.taskId);
  if (!task) notFound();

  return <PublicTaskView task={task} />;
}
