"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell, FormError, FormNotice, SubmitButton, TextField } from "@/components/auth/AuthShell";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The response is deliberately identical whether or not the account
      // exists, so this page cannot be used to enumerate registered emails.
      const result = await authApi.forgotPassword(email);
      setNotice(result.message);
    } catch (err: any) {
      setError(err?.message ?? "Could not send the reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a link to set a new one."
      footer={
        <Link href="/auth/login" className="font-semibold text-[#f97316] hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <FormNotice message={notice} />

        {!notice && (
          <>
            <TextField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <SubmitButton busy={busy}>Send reset link</SubmitButton>
          </>
        )}
      </form>
    </AuthShell>
  );
}
