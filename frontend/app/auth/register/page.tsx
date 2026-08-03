"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlternateSignIn } from "@/components/auth/AlternateSignIn";
import { AuthShell, FormError, SubmitButton, TextField } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/auth";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registerWithEmail, isBusy, isReady, isAuthenticated, error, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const next = searchParams?.get("next") ?? null;
  const referredBy = searchParams?.get("ref") ?? null;

  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/worker/dashboard";

  useEffect(() => {
    if (isReady && isAuthenticated) router.replace(destination);
  }, [isReady, isAuthenticated, router, destination]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await registerWithEmail({
      email,
      password,
      displayName: displayName || undefined,
      referredBy,
    });
    if (ok) router.push(destination);
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start earning SOL for short tasks. No wallet needed to sign up."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-[#f97316] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />

        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
          }}
          placeholder="you@example.com"
        />

        <TextField
          id="displayName"
          label="Display name"
          type="text"
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Optional"
        />

        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError();
          }}
          hint="At least 10 characters. A short phrase is stronger than a short password."
        />

        <SubmitButton busy={isBusy}>Create account</SubmitButton>

        {/* Set expectations early so the wallet requirement is never a surprise
            at the moment someone tries to cash out. */}
        <p className="text-xs text-gray-500">
          You can browse and complete tasks straight away. To withdraw your earnings you will
          connect a Solana wallet — we will walk you through it.
        </p>
      </form>

      <div className="mt-6">
        <AlternateSignIn onSuccess={() => router.push(destination)} referredBy={referredBy} />
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <RegisterForm />
    </Suspense>
  );
}
