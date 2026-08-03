"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { AppShell } from "@/components/shared/AppShell";
import { showToast } from "@/components/Toast";
import { RoleGuard, useAuth } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { AlertCircle, Check, Mail, Shield, Wallet } from "lucide-react";

/**
 * Account settings.
 *
 * The important job here is closing the gaps a given signup route leaves:
 * a wallet-first account has no email and cannot recover access; an email-first
 * account has no wallet and cannot withdraw. Both are surfaced as prompts
 * rather than buried in a form.
 */
function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="mt-0.5 text-gray-400">{icon}</div>
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { account, refresh, linkWallet, walletConnected, walletAddress, isBusy, error, clearError } =
    useAuth();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [linkEmailValue, setLinkEmailValue] = useState("");
  const [linkPasswordValue, setLinkPasswordValue] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const isNew = searchParams?.get("welcome") === "1";

  useEffect(() => {
    setDisplayName(account?.displayName ?? "");
  }, [account?.displayName]);

  if (!account) return null;

  const handleLinkWallet = async () => {
    clearError();
    if (await linkWallet()) showToast("Wallet linked — you can withdraw now", "success");
  };

  const handleUnlinkWallet = async () => {
    try {
      await authApi.unlinkWallet();
      await refresh();
      showToast("Wallet removed", "success");
    } catch (err: any) {
      showToast(err?.message ?? "Could not remove the wallet", "error");
    }
  };

  const handleLinkEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await authApi.linkEmail({ email: linkEmailValue, password: linkPasswordValue });
      await refresh();
      showToast("Email added — check your inbox to verify it", "success");
      setLinkEmailValue("");
      setLinkPasswordValue("");
    } catch (err: any) {
      showToast(err?.message ?? "Could not add that email", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile({ displayName });
      await refresh();
      showToast("Profile updated", "success");
    } catch (err: any) {
      showToast(err?.message ?? "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await authApi.resendVerification();
      showToast("Verification email sent", "success");
    } catch (err: any) {
      showToast(err?.message ?? "Could not send the email", "error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage how you sign in and where your earnings are paid.
        </p>
      </header>

      {isNew && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Welcome to DojoPay. Connect a wallet below whenever you are ready — you can start
          completing tasks straight away.
        </div>
      )}

      {/* The single most consequential state on this page: no wallet means the
          person can earn but not get paid, so it leads. */}
      {!account.walletAddress && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">You cannot withdraw yet</p>
              <p className="mt-1 text-amber-800">
                Connect a Solana wallet to receive your earnings. You keep the keys — DojoPay
                never holds your funds.
              </p>
            </div>
          </div>
        </div>
      )}

      <Section
        icon={<Wallet className="h-5 w-5" />}
        title="Solana wallet"
        description="Where your SOL is sent when you withdraw."
      >
        {account.walletAddress ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Check className="h-4 w-4 text-green-600" />
                  Connected
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-gray-600">
                  {account.walletAddress}
                </div>
              </div>
              <button
                onClick={handleUnlinkWallet}
                className="flex-shrink-0 text-xs font-medium text-gray-600 hover:text-red-600"
              >
                Remove
              </button>
            </div>
            <p className="text-xs text-gray-500">
              A wallet can only belong to one DojoPay account, and cannot be removed while you
              have earnings pending.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {walletConnected ? (
              <>
                <div className="rounded-lg border border-gray-200 px-4 py-3">
                  <div className="text-xs text-gray-500">Detected wallet</div>
                  <div className="mt-0.5 truncate font-mono text-xs text-gray-900">
                    {walletAddress}
                  </div>
                </div>
                <button
                  onClick={handleLinkWallet}
                  disabled={isBusy}
                  className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50"
                >
                  {isBusy ? "Waiting for signature…" : "Link this wallet"}
                </button>
                {/* Ownership is proven, never asserted. */}
                <p className="text-xs text-gray-500">
                  You will be asked to sign a message. This proves you control the wallet and
                  costs nothing.
                </p>
              </>
            ) : (
              // Our own button rather than the adapter's `WalletMultiButton`,
              // whose fixed purple styling and "Select Wallet" label read as a
              // settings control instead of an action, and cannot be sized to
              // match the rest of this page.
              <button
                type="button"
                onClick={() => setWalletModalVisible(true)}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#f97316] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2"
              >
                <Wallet className="h-[18px] w-[18px]" />
                Connect a wallet
              </button>
            )}
          </div>
        )}
      </Section>

      <Section
        icon={<Mail className="h-5 w-5" />}
        title="Email"
        description="Used to sign in and to recover your account."
      >
        {account.email ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-900">{account.email}</div>
              <div className="mt-0.5 text-xs">
                {account.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <Check className="h-3 w-3" /> Verified
                  </span>
                ) : (
                  <span className="text-amber-700">Not verified yet</span>
                )}
              </div>
            </div>
            {!account.emailVerified && (
              <button
                onClick={handleResendVerification}
                className="flex-shrink-0 text-xs font-semibold text-[#f97316] hover:underline"
              >
                Resend
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleLinkEmail} className="space-y-3">
            {/* A wallet-only account has no recovery path at all if the wallet
                is lost, so this is a real risk, not an upsell. */}
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              You signed up with a wallet. Adding an email means you can still reach your account
              if you lose access to it.
            </p>
            <input
              type="email"
              required
              value={linkEmailValue}
              onChange={(e) => setLinkEmailValue(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
            <input
              type="password"
              required
              minLength={10}
              value={linkPasswordValue}
              onChange={(e) => setLinkPasswordValue(e.target.value)}
              placeholder="Choose a password (10+ characters)"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Add email
            </button>
          </form>
        )}
      </Section>

      <Section icon={<Shield className="h-5 w-5" />} title="Profile">
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-gray-800">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs">
            <div>
              <dt className="text-gray-500">Signed up with</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{account.signupProvider}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Member since</dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {new Date(account.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Save changes
          </button>
        </form>
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  const { mode } = useAuth();

  return (
    <RoleGuard role={mode}>
      <AppShell role={mode} activeView="dashboard">
        <Suspense fallback={<div className="p-6" />}>
          <SettingsContent />
        </Suspense>
      </AppShell>
    </RoleGuard>
  );
}
