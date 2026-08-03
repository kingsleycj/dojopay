"use client";

import Link from "next/link";
import { cn } from "@/components/lib/utils";
import { lamportsToSol } from "@/utils/convert";

/**
 * App design primitives.
 *
 * The pieces every signed-in surface is assembled from, so a stat card on the
 * creator dashboard and one on the worker dashboard are literally the same
 * component rather than two similar-looking copies that drift. Deliberately
 * small and unopinionated — anything that needs to know about tasks, vaults, or
 * payouts belongs in a feature component, not here.
 *
 * Mode accents come from `--mode-accent`, re-pointed by `data-mode` on the
 * shell, so nothing in this file needs to know whether it is being rendered on
 * the creator or the worker side.
 */

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Page({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="app-enter mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-mode">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-6 sm:mb-8", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Surface({
  children,
  className,
  interactive,
  as: Component = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Component
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-soft",
        interactive && "app-press hover:border-accent-mode hover:shadow-card",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * A lamport amount, rendered as SOL.
 *
 * Every money figure in the app goes through here so precision is handled in
 * exactly one place. Lamports cross the wire as strings (CLAUDE.md §5) and are
 * only ever converted for display.
 */
export function Sol({
  lamports,
  className,
  decimals,
  showUnit = true,
  sign,
}: {
  lamports: string | number | bigint;
  className?: string;
  decimals?: number;
  showUnit?: boolean;
  /** Prefixes `+`/`−` for ledger rows where direction matters more than size. */
  sign?: "in" | "out";
}) {
  const value = lamportsToSol(String(lamports), decimals);

  return (
    <span className={cn("tabular-nums", className)}>
      {sign === "in" && <span aria-hidden>+</span>}
      {sign === "out" && <span aria-hidden>−</span>}
      {value}
      {showUnit && <span className="ml-1 text-[0.85em] opacity-70">SOL</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "accent" | "positive" | "warning";
  className?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    accent: "text-accent-mode",
    positive: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
  }[tone];

  return (
    <Surface className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-xl font-bold tracking-tight sm:text-2xl", toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Surface>
  );
}

export function StatGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "app-stagger grid gap-3 sm:gap-4",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type PillTone = "neutral" | "accent" | "positive" | "warning" | "danger";

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  const tones: Record<PillTone, string> = {
    neutral: "bg-muted text-muted-foreground",
    accent: "bg-accent-mode-soft text-accent-mode",
    positive:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    danger: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** How each task status should read. Mapped once so no view invents its own. */
const TASK_STATUS: Record<string, { label: string; tone: PillTone }> = {
  OPEN: { label: "Open", tone: "accent" },
  COMPLETED: { label: "Filled", tone: "positive" },
  EXPIRED: { label: "Expired", tone: "warning" },
  REFUNDED: { label: "Closed early", tone: "neutral" },
  FORCE_CLOSED: { label: "Closed by admin", tone: "danger" },
};

export function TaskStatusPill({ status }: { status: string }) {
  const meta = TASK_STATUS[status] ?? { label: status, tone: "neutral" as PillTone };
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

/**
 * A capacity bar.
 *
 * Reads as "how much of what was paid for has been used", which is the number a
 * creator actually cares about and the one a worker uses to judge whether a task
 * is worth starting.
 */
export function ProgressBar({
  value,
  max,
  className,
  label,
}: {
  value: number;
  max: number;
  className?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className={className}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? `${value} of ${max}`}
      >
        <div
          className="h-full rounded-full bg-accent-mode transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "app-focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-none whitespace-nowrap";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent-mode text-white hover:opacity-90",
  secondary: "border border-border bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 " +
    "dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  children,
  className,
  disabled,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      disabled={disabled || loading}
      // Announced rather than only shown, so the state is not purely visual.
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  children,
  className,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    >
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Empty and loading states
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Surface className="app-enter flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-mode-soft text-accent-mode">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </Surface>
  );
}

/**
 * Loading placeholders.
 *
 * Skeletons rather than a centred spinner, and shaped like the content they
 * stand in for: the page does not jump when data lands, and the reader can start
 * parsing the layout before the numbers arrive.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("app-skeleton rounded-md", className)} aria-hidden />;
}

export function StatGridSkeleton({ columns = 4 }: { columns?: 2 | 3 | 4 }) {
  return (
    <StatGrid columns={columns}>
      {Array.from({ length: columns }).map((_, index) => (
        <Surface key={index} className="p-4 sm:p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-2 h-3 w-16" />
        </Surface>
      ))}
    </StatGrid>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Surface className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </Surface>
  );
}

/**
 * A screen-reader announcement for state that is otherwise only visual.
 *
 * Loading and empty states are conveyed by shape and colour; without this a
 * screen reader hears nothing change between "loading" and "no results".
 */
export function LiveRegion({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export const inputClass =
  "app-focus-ring h-10 w-full rounded-lg border border-input bg-background px-3 text-sm " +
  "text-foreground placeholder:text-muted-foreground focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...rest} />;
}

/** A labelled on/off control. Used for every preference toggle in settings. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "app-focus-ring relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-accent-mode" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

/** An inline explanation or warning attached to a form or a panel. */
export function Callout({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const tones = {
    info: "border-border bg-muted/50 text-foreground",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    danger:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  };

  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={cn(title && "mt-1", "text-[0.8125rem] leading-relaxed opacity-90")}>
        {children}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
