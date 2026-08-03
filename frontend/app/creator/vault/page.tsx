"use client";

import { AppShell } from "@/components/shared/AppShell";
import { VaultPanel } from "@/components/creator/VaultPanel";
import { Page, PageHeader } from "@/components/ui-kit";
import { RoleGuard } from "@/lib/auth";

export default function VaultPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator">
        <Page>
          <PageHeader
            eyebrow="Creator"
            title="Vault"
            description="Your SOL on DojoPay. Top it up once, fund any number of tasks from it, and take back whatever is unspent."
          />
          <VaultPanel />
        </Page>
      </AppShell>
    </RoleGuard>
  );
}
