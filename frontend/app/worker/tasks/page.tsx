"use client";

import { AppShell } from "@/components/shared/AppShell";
import { WorkerTasksContent } from "@/components/worker/WorkerTasksContent";
import { RoleGuard } from "@/lib/auth";

export default function WorkerTasksPage() {
  return (
    <RoleGuard role="worker">
      <AppShell role="worker" activeView="tasks">
        <WorkerTasksContent />
      </AppShell>
    </RoleGuard>
  );
}
