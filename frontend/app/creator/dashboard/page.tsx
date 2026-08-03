"use client";

import { AppShell } from "@/components/shared/AppShell";
import { CreatorDashboard } from "@/components/creator/CreatorDashboard";
import { RoleGuard } from "@/lib/auth";

export default function CreatorDashboardPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator">
        <CreatorDashboard />
      </AppShell>
    </RoleGuard>
  );
}
