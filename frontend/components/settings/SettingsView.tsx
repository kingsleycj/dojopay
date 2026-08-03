"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  AlertCircle,
  Bell,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Mail,
  ShieldCheck,
  Sliders,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { showToast } from "@/components/Toast";
import {
  Button,
  Callout,
  Field,
  Input,
  Page,
  PageHeader,
  Pill,
  Sol,
  Surface,
  Toggle,
} from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { useVault } from "@/hooks/useVault";
import { useAuth } from "@/lib/auth";
import { authApi, workerEndpoints, type AccountPreferences } from "@/lib/api";
import { SOLANA_NETWORK } from "@/lib/solana/config";

/**
 * Account settings.
 *
 * Two jobs, in order of importance:
 *
 *  1. **Close the gap a given signup route leaves.** A wallet-first account has
 *     no email and cannot recover access; an email-first account has no wallet
 *     and cannot withdraw. Both are surfaced as prompts at the top rather than
 *     buried in a form somebody has to go looking for.
 *  2. **Everything else you would expect of a real account page** — profile,
 *     password, connected methods, notification preferences, default surface,
 *     balances, and a plainly-labelled danger zone.
 *
 * Grouped into navigable sections rather than one long scroll: the page has ten
 * times the content it used to and a flat list would bury the parts that matter.
 */

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "wallet", label: "Wallet & balances", icon: Wallet },
  { id: "security", label: "Sign-in & security", icon: ShieldCheck },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "danger", label: "Danger zone", icon: Trash2 },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsView() {
  const searchParams = useSearchParams();
  const { account, refresh, linkWallet, walletConnected, walletAddress, isBusy, error, clearError } =
    useAuth();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { vault } = useVault();

  const [section, setSection] = useState<SectionId>("profile");
  const [pendingEarnings, setPendingEarnings] = useState<string | null>(null);

  const isNew = searchParams?.get("welcome") === "1";

  useEffect(() => {
    // Best-effort: the worker balance is context on this page, not its subject.
    workerEndpoints
      .balance()
      .then((balance) => setPendingEarnings(balance.pendingAmount))
      .catch(() => setPendingEarnings(null));
  }, []);

  const gaps = useMemo(() => {
    if (!account) return [];
    const list: Array<{ tone: "warning" | "info"; title: string; body: string; target: SectionId }> = [];

    if (!account.walletAddress) {
      list.push({
        tone: "warning",
        title: "No wallet connected",
        body: "You can browse, post and answer tasks without one, but withdrawals need somewhere to send the SOL.",
        target: "wallet",
      });
    }
    if (!account.email) {
      list.push({
        tone: "warning",
        title: "No email on this account",
        body: "Without one there is no way to recover access if you lose your wallet.",
        target: "security",
      });
    } else if (!account.emailVerified) {
      list.push({
        tone: "info",
        title: "Email not verified",
        body: "Verify your address so password recovery works when you need it.",
        target: "security",
      });
    }
    return list;
  }, [account]);

  if (!account) return null;

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Your account, how you sign in, and where your SOL goes."
      />

      {isNew && (
        <div className="mb-6">
          <Callout tone="success" title="Welcome to DojoPay">
            Your account is ready. Finish anything flagged below and you are fully set up.
          </Callout>
        </div>
      )}

      {error && (
        <div className="mb-6">
          <Callout tone="danger" action={<Button size="sm" variant="secondary" onClick={clearError}>Dismiss</Button>}>
            {error}
          </Callout>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="app-stagger mb-6 space-y-3">
          {gaps.map((gap) => (
            <Callout
              key={gap.title}
              tone={gap.tone}
              title={gap.title}
              action={
                <Button size="sm" variant="secondary" onClick={() => setSection(gap.target)}>
                  Fix this
                </Button>
              }
            >
              {gap.body}
            </Callout>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr] lg:items-start">
        <nav className="app-enter lg:sticky lg:top-24" aria-label="Settings sections">
          <div className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((entry) => {
              const Icon = entry.icon;
              const active = section === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSection(entry.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "app-focus-ring flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent-mode-soft text-accent-mode"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    entry.id === "danger" && !active && "text-red-600/80 dark:text-red-400/80",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {entry.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {section === "profile" && <ProfileSection />}

          {section === "wallet" && (
            <WalletSection
              vaultAvailable={vault?.available ?? "0"}
              vaultReserved={vault?.reserved ?? "0"}
              pendingEarnings={pendingEarnings}
              onConnect={() => setWalletModalVisible(true)}
              onLink={linkWallet}
              walletConnected={walletConnected}
              connectedAddress={walletAddress}
              isBusy={isBusy}
            />
          )}

          {section === "security" && <SecuritySection onChanged={refresh} />}
          {section === "notifications" && <NotificationsSection />}
          {section === "preferences" && <PreferencesSection />}
          {section === "danger" && <DangerSection />}
        </div>
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function Panel({
  title,
  description,
  children,
  tone,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <Surface
      className={cn(
        "app-enter p-5 sm:p-6",
        tone === "danger" && "border-red-200 dark:border-red-900",
      )}
    >
      <h2
        className={cn(
          "text-base font-semibold",
          tone === "danger" ? "text-red-700 dark:text-red-400" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </Surface>
  );
}

function ProfileSection() {
  const { account, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(account?.displayName ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(account?.displayName ?? "");
  }, [account?.displayName]);

  const save = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({ displayName: displayName.trim() });
      await refresh();
      showToast("Profile updated", "success");
    } catch (error: any) {
      showToast(error?.message ?? "Could not save your profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const dirty = displayName.trim() !== (account?.displayName ?? "").trim();

  return (
    <>
      <Panel title="Profile" description="How you appear across DojoPay.">
        <div className="space-y-4">
          <Field
            label="Display name"
            htmlFor="display-name"
            hint="Shown to creators alongside your answers."
          >
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              placeholder="Your name"
            />
          </Field>

          <Button onClick={save} disabled={!dirty} loading={saving}>
            Save changes
          </Button>
        </div>
      </Panel>

      <Panel title="Account" description="Details you cannot change from here.">
        <dl className="divide-y divide-border text-sm">
          <Row label="Account ID">
            <span className="font-mono text-xs">{account?.id}</span>
          </Row>
          <Row label="Joined">
            {account
              ? new Date(account.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </Row>
          <Row label="Signed up with">
            <Pill>{account?.signupProvider.toLowerCase()}</Pill>
          </Row>
          <Row label="Status">
            <Pill tone={account?.status === "ACTIVE" ? "positive" : "danger"}>
              {account?.status.toLowerCase()}
            </Pill>
          </Row>
        </dl>
      </Panel>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet & balances
// ---------------------------------------------------------------------------

function WalletSection({
  vaultAvailable,
  vaultReserved,
  pendingEarnings,
  onConnect,
  onLink,
  walletConnected,
  connectedAddress,
  isBusy,
}: {
  vaultAvailable: string;
  vaultReserved: string;
  pendingEarnings: string | null;
  onConnect: () => void;
  onLink: () => Promise<boolean>;
  walletConnected: boolean;
  connectedAddress: string | null;
  isBusy: boolean;
}) {
  const { account, refresh } = useAuth();
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);

  const linked = account?.walletAddress ?? null;

  const copy = useCallback(async () => {
    if (!linked) return;
    try {
      await navigator.clipboard.writeText(linked);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast("Could not copy — select the address manually", "error");
    }
  }, [linked]);

  const unlink = async () => {
    const confirmed = window.confirm(
      "Remove this wallet?\n\nYou will not be able to withdraw or top up until you connect another one.",
    );
    if (!confirmed) return;

    setUnlinking(true);
    try {
      await authApi.unlinkWallet();
      await refresh();
      showToast("Wallet removed", "success");
    } catch (error: any) {
      showToast(error?.message ?? "Could not remove that wallet", "error");
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <>
      <Panel
        title="Payout wallet"
        description="Where your SOL is sent, and where top-ups must come from."
      >
        {linked ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-foreground">{linked}</p>
                <p className="text-xs text-muted-foreground">
                  Connected{" "}
                  {account?.walletLinkedAt
                    ? new Date(account.walletLinkedAt).toLocaleDateString()
                    : ""}{" "}
                  · {SOLANA_NETWORK}
                </p>
              </div>
              <button
                type="button"
                onClick={copy}
                className="app-focus-ring rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label="Copy wallet address"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <a
                href={`https://explorer.solana.com/address/${linked}?cluster=${SOLANA_NETWORK}`}
                target="_blank"
                rel="noopener noreferrer"
                className="app-focus-ring rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label="View on Solana Explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <Button variant="danger" size="sm" onClick={unlink} loading={unlinking}>
              Remove wallet
            </Button>
            <p className="text-xs text-muted-foreground">
              Refused while you have unwithdrawn earnings, or if it is the only way you can sign in.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Callout tone="warning">
              Without a wallet you can still earn and post — you just cannot move SOL in or out.
            </Callout>

            {walletConnected && connectedAddress ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connected as <span className="font-mono text-xs">{connectedAddress}</span>.
                  Approve one signature to prove you control it.
                </p>
                <Button onClick={() => void onLink()} loading={isBusy}>
                  <ShieldCheck className="h-4 w-4" />
                  Link this wallet
                </Button>
              </div>
            ) : (
              <Button onClick={onConnect}>
                <Wallet className="h-4 w-4" />
                Connect a wallet
              </Button>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Balances" description="Two separate balances, both yours.">
        <dl className="divide-y divide-border text-sm">
          <Row label="Vault — available">
            <Sol lamports={vaultAvailable} decimals={6} />
          </Row>
          <Row label="Vault — reserved for open tasks">
            <Sol lamports={vaultReserved} decimals={6} />
          </Row>
          <Row label="Earnings — ready to withdraw">
            {pendingEarnings === null ? "—" : <Sol lamports={pendingEarnings} decimals={6} />}
          </Row>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Your vault funds tasks you post. Your earnings come from tasks you answer. They are kept
          apart on purpose — spending what you earned would blur the two.
        </p>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

function SecuritySection({ onChanged }: { onChanged: () => Promise<void> }) {
  const { account } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const linkEmail = async () => {
    setBusy("link-email");
    try {
      await authApi.linkEmail({ email: email.trim(), password });
      await onChanged();
      setEmail("");
      setPassword("");
      showToast("Email added — check your inbox to verify it", "success");
    } catch (error: any) {
      showToast(error?.message ?? "Could not add that email", "error");
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    setBusy("resend");
    try {
      await authApi.resendVerification();
      showToast("Verification email sent", "success");
    } catch (error: any) {
      showToast(error?.message ?? "Could not send that email", "error");
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async () => {
    setBusy("password");
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      showToast("Password updated", "success");
    } catch (error: any) {
      showToast(error?.message ?? "Could not change your password", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Panel title="Email address" description="Used for account recovery and important notices.">
        {account?.email ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Mail className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{account.email}</p>
                {account.emailVerified ? (
                  <Pill tone="positive">Verified</Pill>
                ) : (
                  <Pill tone="warning">Not verified</Pill>
                )}
              </div>
            </div>
            {!account.emailVerified && (
              <Button size="sm" variant="secondary" onClick={resend} loading={busy === "resend"}>
                Resend link
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Callout tone="warning">
              This account signed in with a wallet. Add an email and password so you can still get
              in if you lose access to it.
            </Callout>
            <Field label="Email" htmlFor="link-email">
              <Input
                id="link-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" htmlFor="link-password" hint="At least 10 characters.">
              <Input
                id="link-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Button
              onClick={linkEmail}
              disabled={!email.trim() || password.length < 10}
              loading={busy === "link-email"}
            >
              Add email
            </Button>
          </div>
        )}
      </Panel>

      <Panel
        title="Password"
        description={
          account?.hasPassword
            ? "Change the password you sign in with."
            : "Set a password so you can sign in without Google."
        }
      >
        <div className="space-y-4">
          {account?.hasPassword && (
            <Field label="Current password" htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </Field>
          )}
          <Field
            label="New password"
            htmlFor="new-password"
            hint="At least 10 characters. Cannot contain “dojopay” or “solana”."
          >
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Button
            onClick={changePassword}
            disabled={newPassword.length < 10 || (account?.hasPassword && !currentPassword)}
            loading={busy === "password"}
          >
            <KeyRound className="h-4 w-4" />
            {account?.hasPassword ? "Change password" : "Set password"}
          </Button>
        </div>
      </Panel>

      <Panel title="Sign-in methods" description="Every way you can get into this account.">
        <div className="space-y-2">
          <Method label="Email and password" active={Boolean(account?.hasPassword)} />
          <Method label="Google" active={Boolean(account?.hasGoogle)} />
          <Method label="Solana wallet" active={Boolean(account?.walletAddress)} />
        </div>
        <Callout tone="info">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Signing out clears this device only — there is no server-side session list yet, so a
              token stays valid until it expires. Change your password if you think one has leaked.
            </span>
          </span>
        </Callout>
      </Panel>
    </>
  );
}

function Method({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
      <span className="text-sm text-foreground">{label}</span>
      {active ? <Pill tone="positive">Enabled</Pill> : <Pill>Not set up</Pill>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications and preferences
// ---------------------------------------------------------------------------

function NotificationsSection() {
  const { account, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AccountPreferences | null>(account?.preferences ?? null);

  useEffect(() => {
    if (account?.preferences) setDraft(account.preferences);
  }, [account?.preferences]);

  /**
   * Saved on toggle rather than behind a Save button.
   *
   * A preference switch that does nothing until you find a button elsewhere on
   * the page is the classic way these get silently lost. The local state is
   * updated first so the switch responds instantly, and rolled back if the
   * request fails.
   */
  const update = useCallback(
    async (patch: Partial<AccountPreferences>) => {
      if (!draft) return;
      const previous = draft;
      setDraft({ ...draft, ...patch });
      setSaving(true);

      try {
        await authApi.updatePreferences(patch);
        await refresh();
      } catch (error: any) {
        setDraft(previous);
        showToast(error?.message ?? "Could not save that preference", "error");
      } finally {
        setSaving(false);
      }
    },
    [draft, refresh],
  );

  if (!draft) return null;

  return (
    <>
      <Panel title="Email notifications" description="What DojoPay emails you about.">
        <div className="divide-y divide-border">
          <Toggle
            label="Task activity"
            description="When a task you posted fills up or closes."
            checked={draft.notifyTaskActivity}
            disabled={saving}
            onChange={(next) => update({ notifyTaskActivity: next })}
          />
          <Toggle
            label="Payouts"
            description="When a withdrawal is confirmed on chain."
            checked={draft.notifyPayouts}
            disabled={saving}
            onChange={(next) => update({ notifyPayouts: next })}
          />
          <Toggle
            label="Product news"
            description="Occasional updates about new features. Off by default."
            checked={draft.notifyProductNews}
            disabled={saving}
            onChange={(next) => update({ notifyProductNews: next })}
          />
        </div>

        <Callout tone="info">
          Security email — address verification, password resets, and account suspensions — is not
          switchable. It is not marketing, and turning it off would mean losing access to your
          account with no way back.
        </Callout>
      </Panel>
    </>
  );
}

function PreferencesSection() {
  const { account, refresh, mode, setMode } = useAuth();
  const [saving, setSaving] = useState(false);

  const current = account?.preferences.defaultMode ?? "WORKER";

  const setDefault = async (next: "CREATOR" | "WORKER") => {
    if (next === current) return;
    setSaving(true);
    try {
      await authApi.updatePreferences({ defaultMode: next });
      await refresh();
      showToast(`You will land on the ${next.toLowerCase()} side from now on`, "success");
    } catch (error: any) {
      showToast(error?.message ?? "Could not save that preference", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Panel
        title="Default surface"
        description="Which side of DojoPay you land on after signing in. You can always switch."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: "WORKER", title: "Earn", body: "Answer tasks and build up a balance." },
              { value: "CREATOR", title: "Post", body: "Fund tasks and collect answers." },
            ] as const
          ).map((option) => {
            const active = current === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => setDefault(option.value)}
                className={cn(
                  "app-focus-ring app-press rounded-xl border-2 p-4 text-left transition-colors",
                  active
                    ? "border-accent-mode bg-accent-mode-soft"
                    : "border-border hover:border-accent-mode/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{option.title}</p>
                  {active && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-mode text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{option.body}</p>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="This session" description="Applies until you switch again.">
        <dl className="divide-y divide-border text-sm">
          <Row label="Currently viewing">
            <Pill tone="accent">{mode === "creator" ? "Creator" : "Worker"}</Pill>
          </Row>
          <Row label="Network">
            <Pill tone={SOLANA_NETWORK === "mainnet-beta" ? "positive" : "warning"}>
              {SOLANA_NETWORK}
            </Pill>
          </Row>
        </dl>

        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMode(mode === "creator" ? "worker" : "creator")}
          >
            Switch to {mode === "creator" ? "worker" : "creator"} view
          </Button>
        </div>

        {SOLANA_NETWORK !== "mainnet-beta" && (
          <Callout tone="warning">
            DojoPay is running on <strong>{SOLANA_NETWORK}</strong>. The SOL here is test SOL and is
            not worth real money.
          </Callout>
        )}
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

function DangerSection() {
  const { signOut } = useAuth();

  return (
    <>
      <Panel
        tone="danger"
        title="Sign out"
        description="Clears your session on this device."
      >
        <Button variant="danger" onClick={signOut}>
          Sign out
        </Button>
      </Panel>

      <Panel
        tone="danger"
        title="Close this account"
        description="Not available from the app."
      >
        <Callout tone="danger">
          Closing an account has to reconcile money first — unwithdrawn earnings, vault balance, and
          budget still committed to open tasks all have to be settled before anything can be
          deleted. Doing that from a button would risk stranding someone&rsquo;s SOL, so it is
          handled by a person. Email{" "}
          <a
            href="mailto:support@dojopay.io"
            className="font-semibold underline underline-offset-2"
          >
            support@dojopay.io
          </a>{" "}
          from your registered address.
        </Callout>
      </Panel>
    </>
  );
}
