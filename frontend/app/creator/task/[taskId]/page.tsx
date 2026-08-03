"use client";

import { AppShell } from "@/components/shared/AppShell";
import { TaskDetail } from "@/components/creator/TaskDetail";
import { RoleGuard } from "@/lib/auth";

export default function CreatorTaskPage({ params }: { params: { taskId: string } }) {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator">
        <TaskDetail taskId={Number(params.taskId)} />
      </AppShell>
    </RoleGuard>
  );
}
