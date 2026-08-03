"use client";

import { AppShell } from "@/components/shared/AppShell";
import { CreatorSpending } from "@/components/creator/CreatorSpending";
import { RoleGuard } from "@/lib/auth";

export default function CreatorSpendingPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator">
        <CreatorSpending />
      </AppShell>
    </RoleGuard>
  );
}
