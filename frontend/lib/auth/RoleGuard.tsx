"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type Role } from "./AuthProvider";

/**
 * Gates a page on a role.
 *
 * Replaces the "Access Denied" block that was copy-pasted into every creator
 * and worker page, each with slightly different redirect behaviour — one used
 * `router.push`, one assigned `window.location.href`, and one rendered a dead
 * end with no way back.
 */
export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { role: currentRole, isReady, isConnected } = useAuth();
  const router = useRouter();

  const allowed = isReady && currentRole === role;

  useEffect(() => {
    if (!isReady) return;
    if (currentRole === role) return;

    // Send the other role to its own dashboard rather than a dead end.
    if (currentRole) {
      router.replace(`/${currentRole}/dashboard`);
      return;
    }

    const next = encodeURIComponent(window.location.pathname + window.location.search);
    router.replace(`/?role=${role}&next=${next}`);
  }, [isReady, currentRole, role, router, isConnected]);

  if (!allowed) {
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

  return <>{children}</>;
}
