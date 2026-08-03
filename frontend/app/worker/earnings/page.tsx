"use client";

import { AppShell } from "@/components/shared/AppShell";
import { WorkerEarnings } from "@/components/worker/WorkerEarnings";
import { RoleGuard } from "@/lib/auth";

export default function WorkerEarningsPage() {
  return (
    <RoleGuard role="worker">
      <AppShell role="worker">
        <WorkerEarnings />
      </AppShell>
    </RoleGuard>
  );
}
