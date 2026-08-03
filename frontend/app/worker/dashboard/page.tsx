"use client";

import { AppShell } from "@/components/shared/AppShell";
import { WorkerDashboard } from "@/components/worker/WorkerDashboard";
import { RoleGuard } from "@/lib/auth";

export default function WorkerDashboardPage() {
  return (
    <RoleGuard role="worker">
      <AppShell role="worker">
        <WorkerDashboard />
      </AppShell>
    </RoleGuard>
  );
}
