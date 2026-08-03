"use client";

import { AppShell } from "@/components/shared/AppShell";
import { CreatorTasksContent } from "@/components/creator/CreatorTasksContent";
import { RoleGuard } from "@/lib/auth";

export default function CreatorTasksPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator" activeView="tasks">
        <CreatorTasksContent />
      </AppShell>
    </RoleGuard>
  );
}
