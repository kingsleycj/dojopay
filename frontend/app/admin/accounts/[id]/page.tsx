"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminEndpoints, type AdminAccountDetail, type AuditEntry } from "@/lib/api";
import { useAdmin } from "@/lib/auth/AdminProvider";
import { lamportsToSol } from "@/utils/convert";
import {
  identify,
  relativeTime,
  SeverityBadge,
  Skeleton,
  StatusBadge,
} from "@/components/admin/primitives";

/**
 * One account, end to end: identity, both role profiles, money, and the full
 * activity timeline including anything an admin did to them.
 *
 * Opening this page is itself audited — staff access to user data should be
 * reviewable, which is how Outlier-style platforms keep support honest.
 */
export default function AdminAccountDetailPage({ params }: { params: { id: string } }) {
  const accountId = Number(params.id);
  const { canModerate } = useAdmin();

  const [account, setAccount] = useState<AdminAccountDetail | null>(null);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moderating, setModerating] = useState(false);
  const [reason, setReason] = useState("");
  const [pendingAction, setPendingAction] = useState<"SUSPEND" | "BAN" | "REACTIVATE" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, timeline] = await Promise.all([
        adminEndpoints.account(accountId),
        adminEndpoints.accountActivity(accountId),
      ]);
      setAccount(detail);
      setActivity(timeline);
    } catch (err) {
      console.error("Failed to load account", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitModeration = async () => {
    if (!pendingAction) return;
    setModerating(true);
    setError(null);
    try {
      await adminEndpoints.moderateAccount(accountId, { action: pendingAction, reason });
      setPendingAction(null);
      setReason("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Could not apply that change");
    } finally {
      setModerating(false);
    }
  };

  if (loading) return <Skeleton rows={8} />;
  if (!account) return <p className="text-sm text-gray-500">Account not found.</p>;

  const pending = account.workerProfile?.pending_amount ?? "0";

  return (
    <div className="space-y-5">
      <Link href="/admin/accounts" className="text-sm text-gray-500 hover:text-gray-300">
        ← Back to accounts
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{identify(account)}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <StatusBadge status={account.status} />
            <span>Account #{account.id}</span>
            <span>· joined {relativeTime(account.createdAt)}</span>
            {account.lastLoginAt && <span>· last seen {relativeTime(account.lastLoginAt)}</span>}
          </div>
          {account.statusReason && (
            <p className="mt-2 rounded-lg border border-amber-900 bg-amber-950 px-3 py-2 text-xs text-amber-200">
              {account.statusReason}
            </p>
          )}
        </div>

        {canModerate && (
          <div className="flex gap-2">
            {account.status === "ACTIVE" ? (
              <>
                <button
                  onClick={() => setPendingAction("SUSPEND")}
                  className="rounded-lg border border-amber-800 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-950"
                >
                  Suspend
                </button>
                <button
                  onClick={() => setPendingAction("BAN")}
                  className="rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950"
                >
                  Ban
                </button>
              </>
            ) : (
              <button
                onClick={() => setPendingAction("REACTIVATE")}
                className="rounded-lg border border-green-800 px-3 py-1.5 text-xs text-green-300 hover:bg-green-950"
              >
                Reactivate
              </button>
            )}
          </div>
        )}
      </header>

      {pendingAction && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <h2 className="text-sm font-semibold">
            {pendingAction === "REACTIVATE" ? "Reactivate" : pendingAction.toLowerCase()} this account?
          </h2>

          {/* Surfaced because banning someone who is owed money needs a human
              decision about how they get paid. */}
          {pendingAction !== "REACTIVATE" && pending !== "0" && (
            <p className="mt-2 rounded-lg border border-amber-900 bg-amber-950 px-3 py-2 text-xs text-amber-200">
              This account is owed {lamportsToSol(pending)} SOL. Suspending does not release or
              remove it — decide separately how they get paid.
            </p>
          )}

          <label htmlFor="reason" className="mt-3 block text-xs text-gray-400">
            Reason (recorded in the audit log, and emailed to the user)
          </label>
          <textarea
            id="reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
            placeholder="Be specific — the user sees this."
          />

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setPendingAction(null);
                setError(null);
              }}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={submitModeration}
              disabled={moderating || reason.trim().length < 5}
              className="rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {moderating ? "Applying…" : "Confirm"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-gray-500">Identity</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Email" value={account.email ?? "—"} />
            <Row label="Verified" value={account.emailVerified ? "yes" : "no"} />
            <Row label="Password" value={account.hasPassword ? "set" : "none"} />
            <Row label="Google" value={account.hasGoogle ? "linked" : "none"} />
            <Row
              label="Wallet"
              value={
                account.walletAddress
                  ? `${account.walletAddress.slice(0, 6)}…${account.walletAddress.slice(-4)}`
                  : "none"
              }
            />
            <Row label="Referred by" value={account.referredBy ?? "—"} />
          </dl>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-gray-500">Worker</h2>
          {account.workerProfile ? (
            <dl className="space-y-2 text-sm">
              <Row label="Pending" value={`${lamportsToSol(pending)} SOL`} />
              <Row
                label="Withdrawn"
                value={`${lamportsToSol(account.workerProfile.withdrawn_amount)} SOL`}
              />
              <Row label="Submissions" value={String(account.workerProfile.submissions.length)} />
              <Row label="Payouts" value={String(account.workerProfile.payouts.length)} />
            </dl>
          ) : (
            <p className="text-sm text-gray-500">Has not worked on any tasks.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-gray-500">Creator</h2>
          {account.creatorProfile ? (
            <dl className="space-y-2 text-sm">
              <Row label="Tasks" value={String(account.creatorProfile.tasks.length)} />
            </dl>
          ) : (
            <p className="text-sm text-gray-500">Has not created any tasks.</p>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900">
        <header className="border-b border-gray-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-300">Activity</h2>
        </header>
        <ul className="max-h-[480px] divide-y divide-gray-800 overflow-y-auto">
          {activity.map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={entry.severity} />
                <span className="font-mono text-xs text-gray-300">{entry.action}</span>
                <span className="text-xs text-gray-600">{relativeTime(entry.createdAt)}</span>
              </div>
              {entry.actorAdmin && (
                <div className="mt-1 text-xs text-amber-400">
                  by admin {entry.actorAdmin.displayName}
                </div>
              )}
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <pre className="mt-1 overflow-x-auto rounded bg-gray-950 p-2 text-[11px] text-gray-500">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              )}
            </li>
          ))}
          {activity.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-gray-500">No activity recorded</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="truncate text-gray-200">{value}</dd>
    </div>
  );
}
