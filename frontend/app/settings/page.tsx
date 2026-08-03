"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { SettingsView } from "@/components/settings/SettingsView";
import { Page, StatGridSkeleton } from "@/components/ui-kit";
import { RoleGuard, useAuth } from "@/lib/auth";

/**
 * Settings sits outside the creator/worker split — it is the same page either
 * way — so the shell follows whichever mode the person was last in rather than
 * forcing them onto one side just to change a password.
 */
export default function SettingsPage() {
  return (
    <RoleGuard role="worker">
      <SettingsShell />
    </RoleGuard>
  );
}

function SettingsShell() {
  const { mode } = useAuth();

  return (
    <AppShell role={mode}>
      {/* `useSearchParams` requires a Suspense boundary to avoid opting the
          whole route into client-side rendering at build time. */}
      <Suspense
        fallback={
          <Page>
            <StatGridSkeleton columns={3} />
          </Page>
        }
      >
        <SettingsView />
      </Suspense>
    </AppShell>
  );
}
