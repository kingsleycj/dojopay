"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminEndpoints, type AdminOverview, type AuditEntry } from "@/lib/api";
import { lamportsToSol } from "@/utils/convert";
import {
  identify,
  relativeTime,
  SeverityBadge,
  Skeleton,
  StatCard,
  StatusBadge,
} from "@/components/admin/primitives";

/**
 * Operator overview.
 *
 * Chosen to answer, in one screen: is the platform growing, can people
 * actually get paid, and has anything alarming happened. The wallet-link rate
 * and outstanding liability are the two numbers that matter most for an
 * email-first signup flow — the first is the funnel's real conversion point,
 * the second is money owed but not yet withdrawn.
 */
export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [series, setSeries] = useState<
    Array<{ date: string; signups: number; submissions: number; tasks: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [overview, growth] = await Promise.all([
        adminEndpoints.overview(),
        adminEndpoints.growth(30),
      ]);
      setData(overview);
      setSeries(growth);
    } catch (error) {
      console.error("Failed to load overview", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton rows={6} />;
  if (!data) return <p className="text-sm text-gray-500">Could not load the overview.</p>;

  const peak = Math.max(1, ...series.map((point) => point.signups + point.submissions));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Overview</h1>
        <p className="mt-1 text-sm text-gray-500">Last 30 days</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Accounts"
          value={data.accounts.total}
          sub={`+${data.accounts.newToday} today · +${data.accounts.newThisWeek} this week`}
        />
        <StatCard
          label="Can be paid"
          value={`${data.accounts.walletLinkRate}%`}
          sub={`${data.accounts.withWallet} wallets linked`}
          tone={Number(data.accounts.walletLinkRate) < 50 ? "warning" : "good"}
        />
        <StatCard
          label="Submissions"
          value={data.work.totalSubmissions}
          sub={`${data.work.submissionsToday} today`}
        />
        <StatCard
          label="Open tasks"
          value={data.tasks.open}
          sub={`${data.tasks.total} all time`}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Paid out"
          value={`${lamportsToSol(data.money.totalPaidOutLamports)} SOL`}
          sub={`${data.money.payoutCount} withdrawals`}
        />
        <StatCard
          label="Owed to workers"
          value={`${lamportsToSol(data.money.outstandingLiabilityLamports)} SOL`}
          sub="Earned, not yet withdrawn"
          tone="warning"
        />
        <StatCard
          label="Failed payouts"
          value={data.money.failedPayouts}
          tone={data.money.failedPayouts > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Suspended"
          value={data.accounts.suspended}
          tone={data.accounts.suspended > 0 ? "warning" : "default"}
        />
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">Signups and submissions</h2>
        <div className="flex h-32 items-end gap-[2px]">
          {series.map((point) => (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col justify-end gap-[1px]"
              title={`${point.date}: ${point.signups} signups, ${point.submissions} submissions`}
            >
              <div
                className="w-full rounded-sm bg-[#f97316]"
                style={{ height: `${(point.signups / peak) * 100}%` }}
              />
              <div
                className="w-full rounded-sm bg-blue-600"
                style={{ height: `${(point.submissions / peak) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#f97316]" /> Signups
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-blue-600" /> Submissions
          </span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-800 bg-gray-900">
          <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-300">Recent signups</h2>
            <Link href="/admin/accounts" className="text-xs text-[#f97316] hover:underline">
              View all
            </Link>
          </header>
          <ul className="divide-y divide-gray-800">
            {data.recentSignups.map((account) => (
              <li key={account.id}>
                <Link
                  href={`/admin/accounts/${account.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-gray-200">{identify(account)}</div>
                    <div className="text-xs text-gray-500">
                      {account.signupProvider} · {relativeTime(account.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={account.status} />
                </Link>
              </li>
            ))}
            {data.recentSignups.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-500">No signups yet</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900">
          <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-300">Needs attention</h2>
            <Link href="/admin/audit" className="text-xs text-[#f97316] hover:underline">
              Full log
            </Link>
          </header>
          <ul className="divide-y divide-gray-800">
            {data.criticalEvents.map((entry: AuditEntry) => (
              <li key={entry.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={entry.severity} />
                  <span className="font-mono text-xs text-gray-300">{entry.action}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {entry.actorAdmin
                    ? `by ${entry.actorAdmin.displayName}`
                    : entry.actorAccount
                      ? `by ${identify(entry.actorAccount)}`
                      : "system"}{" "}
                  · {relativeTime(entry.createdAt)}
                </div>
              </li>
            ))}
            {data.criticalEvents.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-500">
                Nothing needs attention
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
