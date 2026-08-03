"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, FormError, FormNotice, SubmitButton, TextField } from "@/components/auth/AuthShell";
import { authApi } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Caught client-side so a mistyped confirmation does not burn the
    // single-use token.
    if (password !== confirm) {
      setError("Those passwords do not match");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await authApi.resetPassword({ token, password });
      setNotice(result.message);
      setTimeout(() => router.push("/auth/login"), 1500);
    } catch (err: any) {
      setError(err?.message ?? "Could not reset your password");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="That reset link is missing its token.">
        <Link href="/auth/forgot" className="font-semibold text-[#f97316] hover:underline">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <FormNotice message={notice} />

        {!notice && (
          <>
            <TextField
              id="password"
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="At least 10 characters."
            />
            <TextField
              id="confirm"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <SubmitButton busy={busy}>Set new password</SubmitButton>
          </>
        )}
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ResetForm />
    </Suspense>
  );
}
