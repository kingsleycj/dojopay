"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminEndpoints, type AdminAuditPage } from "@/lib/api";
import {
  identify,
  relativeTime,
  SeverityBadge,
  Skeleton,
  TableEmpty,
} from "@/components/admin/primitives";

/**
 * The audit log.
 *
 * Filterable by actor, severity, and action, because in practice you arrive
 * here with a specific question — "what did this admin do", "show me every
 * failed payout", "who touched this task".
 */

/** Grouped so the filter reads as a menu rather than a wall of constants. */
const ACTION_GROUPS: Array<{ label: string; actions: string[] }> = [
  {
    label: "Identity",
    actions: [
      "ACCOUNT_REGISTERED",
      "ACCOUNT_LOGIN",
      "ACCOUNT_LOGIN_FAILED",
      "EMAIL_VERIFIED",
      "PASSWORD_RESET_REQUESTED",
      "PASSWORD_RESET_COMPLETED",
      "PASSWORD_CHANGED",
      "WALLET_LINKED",
      "WALLET_UNLINKED",
      "EMAIL_LINKED",
      "GOOGLE_LINKED",
    ],
  },
  {
    label: "Work",
    actions: ["TASK_CREATED", "TASK_COMPLETED", "TASK_EXPIRED", "SUBMISSION_CREATED"],
  },
  {
    label: "Money",
    actions: ["PAYOUT_REQUESTED", "PAYOUT_SUCCEEDED", "PAYOUT_FAILED"],
  },
  {
    label: "Admin",
    actions: [
      "ADMIN_LOGIN",
      "ADMIN_LOGIN_FAILED",
      "ADMIN_2FA_ENROLLED",
      "ADMIN_VIEWED_ACCOUNT",
      "ADMIN_ACCOUNT_SUSPENDED",
      "ADMIN_ACCOUNT_REACTIVATED",
      "ADMIN_ACCOUNT_BANNED",
      "ADMIN_TASK_FORCE_CLOSED",
      "ADMIN_CREATED",
    ],
  },
];

export default function AdminAuditPageView() {
  const [data, setData] = useState<AdminAuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [severity, setSeverity] = useState("");
  const [actorType, setActorType] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await adminEndpoints.audit({
          page,
          limit: 50,
          action: action || undefined,
          severity: severity || undefined,
          actorType: actorType || undefined,
        }),
      );
    } catch (error) {
      console.error("Failed to load audit log", error);
    } finally {
      setLoading(false);
    }
  }, [page, action, severity, actorType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Audit log</h1>
        <p className="mt-1 text-sm text-gray-500">
          {data ? `${data.pagination.totalItems} events` : "Loading…"} · append-only
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="">All actions</option>
          {ACTION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.actions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="">All severities</option>
          <option value="INFO">Info</option>
          <option value="NOTICE">Notice</option>
          <option value="WARNING">Warning</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <select
          value={actorType}
          onChange={(e) => {
            setActorType(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="">All actors</option>
          <option value="ACCOUNT">Users</option>
          <option value="ADMIN">Admins</option>
          <option value="SYSTEM">System</option>
        </select>

        {(action || severity || actorType) && (
          <button
            onClick={() => {
              setAction("");
              setSeverity("");
              setActorType("");
              setPage(1);
            }}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800"
          >
            Clear
          </button>
        )}
      </div>

      {loading && !data ? (
        <Skeleton rows={10} />
      ) : !data || data.entries.length === 0 ? (
        <TableEmpty message="No events match those filters." />
      ) : (
        <ul className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
          {data.entries.map((entry) => (
            <li key={entry.id} className="px-4 py-3 hover:bg-gray-900/60">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={entry.severity} />
                <span className="font-mono text-xs text-gray-200">{entry.action}</span>

                {entry.entityType && (
                  <span className="text-xs text-gray-600">
                    {entry.entityType}
                    {entry.entityId ? ` #${entry.entityId}` : ""}
                  </span>
                )}

                <span className="ml-auto text-xs text-gray-600">
                  {relativeTime(entry.createdAt)}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {entry.actorAdmin ? (
                  <span className="text-amber-400">admin: {entry.actorAdmin.displayName}</span>
                ) : entry.actorAccount ? (
                  <Link
                    href={`/admin/accounts/${entry.actorAccount.id}`}
                    className="text-gray-400 hover:text-[#f97316]"
                  >
                    {identify(entry.actorAccount)}
                  </Link>
                ) : (
                  <span>system</span>
                )}
                {entry.ipAddress && <span>· {entry.ipAddress}</span>}
              </div>

              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-gray-600">details</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-[11px] text-gray-500">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
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
