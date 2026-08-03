"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminEndpoints, clearToken, getToken, setToken, type AdminSession } from "@/lib/api";

/**
 * Admin session, deliberately separate from the user session.
 *
 * Different storage key, different token, different provider — mounted only
 * under `/admin`, so no user-facing page ever holds admin state and no admin
 * page ever reads a user token.
 */

type Admin = AdminSession["admin"];

interface AdminState {
  admin: Admin | null;
  isReady: boolean;
  isAuthenticated: boolean;
  /** OWNER and ADMIN may moderate; ANALYST is read-only. */
  canModerate: boolean;
  adoptSession: (session: AdminSession) => void;
  signOut: () => void;
}

const AdminContext = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!getToken("admin")) {
      setIsReady(true);
      return;
    }

    void adminEndpoints
      .session()
      .then(setAdmin)
      .catch(() => {
        clearToken("admin");
        setAdmin(null);
      })
      .finally(() => setIsReady(true));
  }, []);

  const adoptSession = useCallback((session: AdminSession) => {
    setToken("admin", session.token);
    setAdmin(session.admin);
  }, []);

  const signOut = useCallback(() => {
    clearToken("admin");
    setAdmin(null);
    router.push("/admin/login");
  }, [router]);

  const value = useMemo<AdminState>(
    () => ({
      admin,
      isReady,
      isAuthenticated: Boolean(admin),
      canModerate: admin?.role === "OWNER" || admin?.role === "ADMIN",
      adoptSession,
      signOut,
    }),
    [admin, isReady, adoptSession, signOut],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminState {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used inside an AdminProvider");
  return context;
}
