"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Coins,
  LayoutDashboard,
  ListChecks,
  PlusCircle,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/components/lib/utils";
import type { Mode } from "@/lib/auth";
import { ModeSwitcherRow } from "./ModeSwitcher";

/**
 * Navigation for both surfaces.
 *
 * One component rather than the previous `CreatorSidebar` and `WorkerSidebar`,
 * which were near-identical files that had already drifted — the creator one was
 * `hidden lg:block`, so creators had no navigation at all on mobile.
 *
 * The active item is derived from the pathname rather than passed in as an
 * `activeView` prop. That removes a whole class of bug where a page forgot to
 * pass it, or passed the wrong one, and the highlight silently pointed
 * somewhere else.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Also treat these prefixes as this item being active. */
  match?: string[];
}

const NAV: Record<Mode, NavItem[]> = {
  creator: [
    { href: "/creator/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/creator/tasks", label: "My tasks", icon: ListChecks, match: ["/creator/task"] },
    { href: "/creator/create", label: "New task", icon: PlusCircle },
    { href: "/creator/vault", label: "Vault", icon: Wallet },
    { href: "/creator/earnings", label: "Spending", icon: BarChart3 },
  ],
  worker: [
    { href: "/worker/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/worker/tasks", label: "Available work", icon: ListChecks },
    { href: "/worker/earnings", label: "Earnings", icon: Coins },
  ],
};

function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  return (item.match ?? []).some((prefix) => pathname.startsWith(prefix));
}

export function SideNav({
  mode,
  mobileOpen,
  onNavigate,
}: {
  mode: Mode;
  mobileOpen: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname() ?? "";
  const items = NAV[mode];

  const links = (
    <nav className="space-y-0.5 px-3" aria-label={`${mode} navigation`}>
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "app-focus-ring group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent-mode-soft text-accent-mode"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {/* A left rule on the active item, so the current page is legible
                even where the soft accent background has low contrast. */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent-mode transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      <div className="pt-2">
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={cn(
            "app-focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-accent-mode-soft text-accent-mode"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop rail. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-card pt-16 lg:block">
        <div className="py-4">{links}</div>
      </aside>

      {/*
        Mobile drawer. Rendered always and translated off-screen rather than
        unmounted, so opening and closing it animates in both directions —
        conditional rendering only ever animates the way in.
      */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={onNavigate}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-64 border-r border-border bg-card pt-16 shadow-elevated",
            "transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ transitionTimingFunction: "var(--ease-out-soft)" }}
        >
          <div className="border-b border-border pb-3">
            <ModeSwitcherRow />
          </div>
          <div className="py-4">{links}</div>
        </aside>
      </div>
    </>
  );
}
