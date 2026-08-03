"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlternateSignIn } from "@/components/auth/AlternateSignIn";
import { AuthShell, FormError, SubmitButton, TextField } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithEmail, isBusy, isReady, isAuthenticated, error, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const next = searchParams?.get("next") ?? null;
  const referredBy = searchParams?.get("ref") ?? null;
  const oauthError = searchParams?.get("error");

  /** Same-origin relative paths only — otherwise this is an open redirect. */
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/worker/dashboard";

  useEffect(() => {
    if (isReady && isAuthenticated) router.replace(destination);
  }, [isReady, isAuthenticated, router, destination]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await loginWithEmail(email, password)) router.push(destination);
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle={next ? "Sign in to continue where you left off" : "Sign in to your DojoPay account"}
      footer={
        <>
          New to DojoPay?{" "}
          <Link href={`/auth/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-[#f97316] hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={oauthError ? "Google sign-in did not complete. Try again." : error} />

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

        <div>
          <TextField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
          />
          <div className="mt-1.5 text-right">
            <Link href="/auth/forgot" className="text-xs text-gray-600 hover:text-gray-900 hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>

        <SubmitButton busy={isBusy}>Sign in</SubmitButton>
      </form>

      <div className="mt-6">
        <AlternateSignIn onSuccess={() => router.push(destination)} referredBy={referredBy} />
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  );
}
