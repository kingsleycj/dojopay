"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminEndpoints } from "@/lib/api";
import { useAdmin } from "@/lib/auth/AdminProvider";
import { lamportsToSol } from "@/utils/convert";
import { identify, relativeTime, Skeleton, StatusBadge, TableEmpty } from "@/components/admin/primitives";

/**
 * Task moderation.
 *
 * Force-closing stops further submissions but deliberately moves no money:
 * workers who already submitted keep what they earned, and refunding the
 * creator is a separate, human decision.
 */
export default function AdminTasksPage() {
  const { canModerate } = useAdmin();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminEndpoints.tasks({ page, limit: 25, status: status || undefined }));
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitClose = async () => {
    if (closing === null) return;
    setError(null);
    try {
      await adminEndpoints.forceCloseTask(closing, reason);
      setClosing(null);
      setReason("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Could not close that task");
    }
  };

  const tasks = (data?.tasks ?? []) as Array<any>;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data ? `${data.pagination.totalItems} total` : "Loading…"}
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="COMPLETED">Completed</option>
          <option value="EXPIRED">Expired</option>
          <option value="FORCE_CLOSED">Force closed</option>
        </select>
      </header>

      {closing !== null && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <h2 className="text-sm font-semibold">Force-close task #{closing}?</h2>
          <p className="mt-1 text-xs text-gray-500">
            No further submissions will be accepted. Workers who already submitted keep their
            earnings; this does not refund the creator.
          </p>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (recorded in the audit log)"
            className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setClosing(null);
                setError(null);
              }}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={submitClose}
              disabled={reason.trim().length < 5}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Force close
            </button>
          </div>
        </div>
      )}

      {loading && !data ? (
        <Skeleton rows={8} />
      ) : tasks.length === 0 ? (
        <TableEmpty message="No tasks match that filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Creator</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Filled</th>
                <th className="px-4 py-3 font-medium">Funded</th>
                <th className="px-4 py-3 font-medium">Created</th>
                {canModerate && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-900/60">
                  <td className="px-4 py-3">
                    <div className="max-w-[240px] truncate text-sm text-gray-100">{task.title}</div>
                    <div className="text-xs text-gray-600">#{task.id}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {task.user?.account ? (
                      <Link
                        href={`/admin/accounts/${task.user.account.id}`}
                        className="text-gray-400 hover:text-[#f97316]"
                      >
                        {identify(task.user.account)}
                      </Link>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{task.submissionCount}/100</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {lamportsToSol(task.amount)} SOL
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {relativeTime(task.createdAt)}
                  </td>
                  {canModerate && (
                    <td className="px-4 py-3 text-right">
                      {task.status === "OPEN" && (
                        <button
                          onClick={() => setClosing(task.id)}
                          className="rounded-lg border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
                        >
                          Close
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={!data.pagination.hasPreviousPage}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {data.pagination.currentPage} of {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((current) => current + 1)}
            disabled={!data.pagination.hasNextPage}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
