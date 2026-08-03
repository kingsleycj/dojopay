"use client";

import type { AuditSeverity } from "@/lib/api";

/** Shared building blocks for the admin screens. */

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warning" | "danger" | "good";
}) {
  const toneClass = {
    default: "border-gray-800",
    good: "border-green-900",
    warning: "border-amber-900",
    danger: "border-red-900",
  }[tone];

  return (
    <div className={`rounded-xl border bg-gray-900 p-4 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

const SEVERITY_STYLES: Record<AuditSeverity, string> = {
  INFO: "bg-gray-800 text-gray-300",
  NOTICE: "bg-blue-950 text-blue-300",
  WARNING: "bg-amber-950 text-amber-300",
  CRITICAL: "bg-red-950 text-red-300",
};

export function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-950 text-green-300",
    SUSPENDED: "bg-amber-950 text-amber-300",
    BANNED: "bg-red-950 text-red-300",
    OPEN: "bg-blue-950 text-blue-300",
    COMPLETED: "bg-green-950 text-green-300",
    EXPIRED: "bg-gray-800 text-gray-400",
    FORCE_CLOSED: "bg-red-950 text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-800 text-gray-300"}`}
    >
      {status}
    </span>
  );
}

/** A human label for an account that may have an email, a wallet, or neither. */
export function identify(account: {
  email?: string | null;
  displayName?: string | null;
  walletAddress?: string | null;
  id?: number;
}): string {
  if (account.email) return account.email;
  if (account.displayName) return account.displayName;
  if (account.walletAddress) {
    return `${account.walletAddress.slice(0, 4)}…${account.walletAddress.slice(-4)}`;
  }
  return `Account #${account.id ?? "?"}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(iso).toLocaleDateString();
}

export function TableEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-gray-900" />
      ))}
    </div>
  );
}
