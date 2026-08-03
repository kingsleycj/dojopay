import type { Metadata } from "next";
import { AdminProvider } from "@/lib/auth/AdminProvider";
import { AdminChrome } from "@/components/admin/AdminChrome";

/**
 * Admin section root.
 *
 * Mounts its own provider, so admin session state exists only under `/admin`.
 * Marked `noindex` — staff tooling has no business in a search index.
 */
export const metadata: Metadata = {
  title: "DojoPay Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminChrome>{children}</AdminChrome>
    </AdminProvider>
  );
}
