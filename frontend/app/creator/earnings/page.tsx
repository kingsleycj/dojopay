"use client";

import { AppShell } from "@/components/shared/AppShell";
import { CreatorEarningsContent } from "@/components/creator/CreatorEarningsContent";
import { RoleGuard } from "@/lib/auth";

export default function CreatorEarningsPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator" activeView="earnings">
        <CreatorEarningsContent />
      </AppShell>
    </RoleGuard>
  );
}
