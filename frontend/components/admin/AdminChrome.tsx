"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdmin } from "@/lib/auth/AdminProvider";

/**
 * Admin shell: dark, deliberately unlike the user app, so it is never
 * ambiguous which surface you are looking at.
 */

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const { admin, isReady, isAuthenticated, signOut } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isReady && !isAuthenticated && !isLoginPage) router.replace("/admin/login");
  }, [isReady, isAuthenticated, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (!isReady || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/admin" className="font-bold whitespace-nowrap">
              DojoPay <span className="text-[#f97316]">Admin</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((item) => {
                const active =
                  item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      active ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:block text-right">
              <div className="text-gray-300">{admin?.displayName}</div>
              {/* Role is always visible: an ANALYST should not be surprised by
                  a disabled button. */}
              <div className="text-xs text-gray-500">{admin?.role}</div>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="flex md:hidden gap-1 overflow-x-auto border-t border-gray-800 px-4 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
