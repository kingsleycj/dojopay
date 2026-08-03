"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminEndpoints } from "@/lib/api";
import { useAdmin } from "@/lib/auth/AdminProvider";

/**
 * Admin sign-in. Always two steps, always ending in TOTP.
 *
 * On first login the server returns an enrolment challenge with a QR code
 * instead of a verification challenge — 2FA is not optional, so there is no
 * "set this up later" path.
 */

type Stage =
  | { kind: "credentials" }
  | { kind: "verify"; challengeToken: string }
  | { kind: "enroll"; challengeToken: string; secret: string; qrCodeDataUrl: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const { adoptSession } = useAdmin();

  const [stage, setStage] = useState<Stage>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await adminEndpoints.login({ email, password });

      setStage(
        result.stage === "ENROLL_2FA"
          ? {
              kind: "enroll",
              challengeToken: result.challengeToken,
              secret: result.totpSecret,
              qrCodeDataUrl: result.qrCodeDataUrl,
            }
          : { kind: "verify", challengeToken: result.challengeToken },
      );
    } catch (err: any) {
      setError(err?.message ?? "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (stage.kind === "credentials") return;

    setBusy(true);
    setError(null);
    try {
      const session =
        stage.kind === "enroll"
          ? await adminEndpoints.enrollTotp({ challengeToken: stage.challengeToken, code })
          : await adminEndpoints.verifyTotp({ challengeToken: stage.challengeToken, code });

      adoptSession(session);
      router.push("/admin");
    } catch (err: any) {
      setError(err?.message ?? "That code is not valid");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xl font-bold">
            DojoPay <span className="text-[#f97316]">Admin</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Staff access only</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          {stage.kind === "credentials" && (
            <form onSubmit={submitCredentials} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm text-gray-400">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-gray-100 focus:border-gray-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm text-gray-400">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-gray-100 focus:border-gray-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50"
              >
                {busy ? "Checking…" : "Continue"}
              </button>
            </form>
          )}

          {stage.kind === "enroll" && (
            <form onSubmit={submitCode} className="space-y-4">
              <div>
                <h1 className="font-semibold">Set up two-factor authentication</h1>
                <p className="mt-1 text-sm text-gray-400">
                  Scan this with an authenticator app, then enter the 6-digit code it shows.
                </p>
              </div>

              <div className="flex justify-center rounded-lg bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stage.qrCodeDataUrl} alt="TOTP QR code" className="h-40 w-40" />
              </div>

              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Can&apos;t scan the code?</summary>
                <p className="mt-2 break-all font-mono text-gray-400">{stage.secret}</p>
                {/* Shown once, at enrolment, and never retrievable afterwards. */}
                <p className="mt-2">
                  Store this somewhere safe. It is not shown again.
                </p>
              </details>

              <CodeInput value={code} onChange={setCode} />

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Confirm and sign in"}
              </button>
            </form>
          )}

          {stage.kind === "verify" && (
            <form onSubmit={submitCode} className="space-y-4">
              <div>
                <h1 className="font-semibold">Two-factor code</h1>
                <p className="mt-1 text-sm text-gray-400">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <CodeInput value={code} onChange={setCode} />

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Sign in"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Admin accounts are created from the server with{" "}
          <code className="text-gray-500">npm run admin:create</code>. There is no sign-up.
        </p>
      </div>
    </div>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={6}
      required
      value={value}
      // Strip anything non-numeric so a pasted code with spaces still works.
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder="000000"
      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-gray-100 focus:border-gray-500 focus:outline-none"
    />
  );
}
