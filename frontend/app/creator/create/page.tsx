"use client";

import { AppShell } from "@/components/shared/AppShell";
import { Upload } from "@/components/Upload";
import { RoleGuard } from "@/lib/auth";

export default function CreateTaskPage() {
  return (
    <RoleGuard role="creator">
      <AppShell role="creator" activeView="create">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create a task</h1>
            <p className="text-sm text-gray-600 mt-1">
              Upload the images workers will choose between, fund the task, and publish.
            </p>
          </header>
          <Upload />
        </div>
      </AppShell>
    </RoleGuard>
  );
}
