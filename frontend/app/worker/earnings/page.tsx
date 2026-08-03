"use client";

import { AppShell } from "@/components/shared/AppShell";
import { WorkerEarningsContent } from "@/components/worker/WorkerEarningsContent";
import { RoleGuard } from "@/lib/auth";

export default function WorkerEarningsPage() {
  return (
    <RoleGuard role="worker">
      <AppShell role="worker" activeView="earnings">
        <WorkerEarningsContent />
      </AppShell>
    </RoleGuard>
  );
}
