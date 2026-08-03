"use client";

import { AppShell } from "@/components/shared/AppShell";
import { CreatorDashboardContent } from "@/components/creator/CreatorDashboardContent";
import { RoleGuard } from "@/lib/auth";

export default function CreatorDashboardPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator" activeView="dashboard">
        <CreatorDashboardContent />
      </AppShell>
    </RoleGuard>
  );
}
