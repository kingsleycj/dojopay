"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell, FormError, FormNotice } from "@/components/auth/AuthShell";
import { authApi } from "@/lib/api";

function VerifyEmail() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("That verification link is missing its token.");
      return;
    }

    void authApi
      .verifyEmail(token)
      .then((result) => setNotice(result.message))
      .catch((err) => setError(err?.message ?? "Could not verify your email"));
  }, [token]);

  return (
    <AuthShell
      title="Email verification"
      footer={
        <Link href="/worker/dashboard" className="font-semibold text-[#f97316] hover:underline">
          Go to your dashboard
        </Link>
      }
    >
      <div className="space-y-4">
        <FormNotice message={notice} />
        <FormError message={error} />
        {!notice && !error && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#f97316]" />
            Verifying…
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <VerifyEmail />
    </Suspense>
  );
}
