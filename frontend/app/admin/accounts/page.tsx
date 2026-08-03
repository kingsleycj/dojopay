"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminEndpoints, type AdminAccountList } from "@/lib/api";
import { lamportsToSol } from "@/utils/convert";
import {
  identify,
  relativeTime,
  Skeleton,
  StatusBadge,
  TableEmpty,
} from "@/components/admin/primitives";

/** Searchable account directory — the entry point for any support question. */
export default function AdminAccountsPage() {
  const [data, setData] = useState<AdminAccountList | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await adminEndpoints.accounts({
          page,
          limit: 25,
          search: search || undefined,
          status: status || undefined,
          provider: provider || undefined,
        }),
      );
    } catch (error) {
      console.error("Failed to load accounts", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, provider]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data ? `${data.pagination.totalItems} total` : "Loading…"}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search email, name, or wallet…"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-gray-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="">All signups</option>
          <option value="EMAIL">Email</option>
          <option value="GOOGLE">Google</option>
          <option value="WALLET">Wallet</option>
        </select>
      </div>

      {loading && !data ? (
        <Skeleton rows={8} />
      ) : !data || data.accounts.length === 0 ? (
        <TableEmpty message="No accounts match those filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Activity</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {data.accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-900/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/accounts/${account.id}`}
                      className="text-sm text-gray-100 hover:text-[#f97316]"
                    >
                      {identify(account)}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {account.signupProvider}
                      {account.email && !account.emailVerified && " · unverified"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={account.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {account.walletAddress ? (
                      <span className="font-mono text-gray-400">
                        {account.walletAddress.slice(0, 4)}…{account.walletAddress.slice(-4)}
                      </span>
                    ) : (
                      // Cannot be paid — worth seeing at a glance.
                      <span className="text-amber-400">none</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {account.workerProfile?._count.submissions ?? 0} submissions ·{" "}
                    {account.creatorProfile?._count.tasks ?? 0} tasks
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {account.workerProfile
                      ? `${lamportsToSol(account.workerProfile.pending_amount)} SOL`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {relativeTime(account.createdAt)}
                  </td>
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
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 hover:bg-gray-800 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {data.pagination.currentPage} of {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((current) => current + 1)}
            disabled={!data.pagination.hasNextPage}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 hover:bg-gray-800 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
