"use client";

import { AppShell } from "@/components/shared/AppShell";
import { TaskComposer } from "@/components/creator/TaskComposer";
import { Page, PageHeader } from "@/components/ui-kit";
import { useVault } from "@/hooks/useVault";
import { RoleGuard } from "@/lib/auth";

export default function CreateTaskPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator">
        <CreateTaskContent />
      </AppShell>
    </RoleGuard>
  );
}

/**
 * Split out so the vault read happens inside the shell, where `data-mode` is
 * already set — the composer reads accent colours from it.
 */
function CreateTaskContent() {
  const { vault } = useVault();

  return (
    <Page>
      <PageHeader
        eyebrow="Creator"
        title="New task"
        description="Choose what workers decide, how much you are putting up, and how many answers you want."
      />
      <TaskComposer vault={vault} />
    </Page>
  );
}
