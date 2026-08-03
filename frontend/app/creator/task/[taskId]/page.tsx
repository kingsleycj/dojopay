"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { ShareButton } from "@/components/shared/ShareButton";
import { CountdownTimer } from "@/components/CountdownTimer";
import { RoleGuard, useAuth } from "@/lib/auth";
import { creatorEndpoints, type TaskResults } from "@/lib/api";
import { lamportsToSol } from "@/utils/convert";

const SUBMISSIONS_PER_PAGE = 10;

function TaskDetail({ taskId }: { taskId: number }) {
  const router = useRouter();
  const { walletAddress } = useAuth();
  const [data, setData] = useState<TaskResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setData(await creatorEndpoints.getTaskResults(taskId));
    } catch (error) {
      console.error("Failed to load task", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Task unavailable</h1>
        <p className="text-gray-600 mb-4">
          We could not load this task. It may have been removed.
        </p>
        <button
          onClick={() => router.push("/creator/tasks")}
          className="text-[#f97316] font-medium hover:underline"
        >
          Back to tasks
        </button>
      </div>
    );
  }

  const { result, taskDetails, submissions } = data;
  const optionIds = Object.keys(result);
  const totalVotes = Object.values(result).reduce((sum, entry) => sum + entry.count, 0);
  const totalPages = Math.ceil(submissions.length / SUBMISSIONS_PER_PAGE);
  const rewardSol = lamportsToSol(
    (BigInt(taskDetails.amount) / BigInt(taskDetails.maxSubmissions)).toString(),
  ).toString();

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <button
        onClick={() => router.push("/creator/tasks")}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-medium">Back to Tasks</span>
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
              {taskDetails.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                {taskDetails.status}
              </span>
              <span className="text-gray-600">
                {taskDetails.totalSubmissions} / {taskDetails.maxSubmissions} submissions
              </span>
              {taskDetails.expiresAt && (
                <CountdownTimer expiresAt={taskDetails.expiresAt} compact />
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {/* Sharing a task is how a creator fills it — the reward and the
                sharer's address travel with the link. */}
            <ShareButton
              taskId={taskDetails.id}
              title={taskDetails.title}
              rewardSol={rewardSol}
              referrer={walletAddress}
            />
            <button
              onClick={() => router.push(`/creator/task/${taskId}/edit`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {optionIds.map((optionId, index) => (
            <OptionCard
              key={optionId}
              index={index + 1}
              imageUrl={result[optionId].option.imageUrl}
              votes={result[optionId].count}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-gray-50 rounded-xl p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Results</h2>
            <div className="space-y-3">
              {optionIds.map((optionId, index) => {
                const votes = result[optionId].count;
                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

                return (
                  <div key={optionId} className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-800">Option {index + 1}</span>
                      <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1 text-sm font-medium text-gray-900">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-[#f97316] transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-600">
                      {votes} {votes === 1 ? "vote" : "votes"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-gray-50 rounded-xl p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Submissions ({submissions.length})
            </h2>

            {submissions.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
                <p>No submissions yet.</p>
                <p className="mt-1 text-sm">Share the task to reach more workers.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Worker
                        </th>
                        <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Option
                        </th>
                        <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          When
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {submissions
                        .slice((page - 1) * SUBMISSIONS_PER_PAGE, page * SUBMISSIONS_PER_PAGE)
                        .map((submission, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="p-3">
                              <span className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-900">
                                {submission.workerAddress.slice(0, 6)}…
                                {submission.workerAddress.slice(-4)}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1 text-sm font-medium text-gray-900">
                                Option {optionIds.indexOf(String(submission.optionId)) + 1}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-gray-500">
                              {new Date(submission.submittedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 border-t border-gray-200 p-3">
                    <button
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  imageUrl,
  votes,
  index,
}: {
  imageUrl: string;
  votes: number;
  index: number;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="aspect-square bg-gray-100">
        {failed ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            Image unavailable
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={`Option ${index}`}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
            loading="lazy"
          />
        )}
      </div>
      <div className="p-3">
        <div className="text-xs font-medium text-gray-500">Option {index}</div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-lg font-bold text-gray-900">{votes}</span>
          <span className="text-xs text-gray-500">{votes === 1 ? "vote" : "votes"}</span>
        </div>
      </div>
    </div>
  );
}

export default function CreatorTaskDetailPage({
  params,
}: {
  params: { taskId: string };
}) {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator" activeView="tasks">
        <TaskDetail taskId={Number(params.taskId)} />
      </AppShell>
    </RoleGuard>
  );
}
