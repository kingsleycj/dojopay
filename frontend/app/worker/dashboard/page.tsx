"use client";

import { AppShell } from "@/components/shared/AppShell";
import { WorkerDashboardContent } from "@/components/worker/WorkerDashboardContent";
import { RoleGuard } from "@/lib/auth";

export default function WorkerDashboardPage() {
  return (
    <RoleGuard role="worker">
      <AppShell role="worker" activeView="dashboard">
        <WorkerDashboardContent />
      </AppShell>
    </RoleGuard>
  );
}
