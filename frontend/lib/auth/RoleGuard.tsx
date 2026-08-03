"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type Mode } from "./AuthProvider";

/**
 * Gates a page on being signed in.
 *
 * With one account covering both modes there is no longer a role to *fail* —
 * anyone signed in may open either dashboard, and the profile is created on
 * first use. This guard therefore checks authentication, syncs the view mode,
 * and surfaces a suspension rather than bouncing the user somewhere confusing.
 */
export function RoleGuard({ role, children }: { role: Mode; children: React.ReactNode }) {
  const { account, isReady, isAuthenticated, mode, setMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;

    if (!isAuthenticated) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/auth/login?next=${next}`);
      return;
    }

    if (mode !== role) setMode(role);
  }, [isReady, isAuthenticated, mode, role, router, setMode]);

  if (!isReady || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316] mx-auto" />
          <p className="mt-4 text-sm text-gray-600">
            {isReady ? "Redirecting…" : "Checking your session…"}
          </p>
        </div>
      </div>
    );
  }

  // A suspended account keeps its session so it can read the reason, but must
  // not be able to act.
  if (account?.status === "SUSPENDED") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="text-lg font-bold text-amber-900 mb-2">Your account is suspended</h1>
          <p className="text-sm text-amber-800">
            You cannot post or complete tasks right now. Any balance you have already earned is
            unaffected.
          </p>
          <a
            href="mailto:support@dojopay.io"
            className="mt-4 inline-block text-sm font-semibold text-amber-900 underline"
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
