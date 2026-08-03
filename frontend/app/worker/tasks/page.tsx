"use client";

import { AppShell } from "@/components/shared/AppShell";
import { WorkerTasks } from "@/components/worker/WorkerTasks";
import { RoleGuard } from "@/lib/auth";

export default function WorkerTasksPage() {
  return (
    <RoleGuard role="worker">
      <AppShell role="worker">
        <WorkerTasks />
      </AppShell>
    </RoleGuard>
  );
}
