"use client";

import { AppShell } from "@/components/shared/AppShell";
import { CreatorTasks } from "@/components/creator/CreatorTasks";
import { RoleGuard } from "@/lib/auth";

export default function CreatorTasksPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator">
        <CreatorTasks />
      </AppShell>
    </RoleGuard>
  );
}
