"use client";

import { useEffect, useRef, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { authApi, googleSignInUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Google and wallet sign-in, shared by the login and register screens.
 *
 * Both options are given equal visual weight, side by side, because neither is
 * the recommended path — email is. Wallet stays first-class (DojoPay is
 * non-custodial and some visitors arrive already holding one), but it is not
 * promoted above Google, since "install a browser extension" is the single
 * biggest drop-off for a new worker.
 *
 * The wallet button is our own rather than the adapter's `WalletMultiButton`:
 * that component ships fixed purple styling and the label "Select Wallet",
 * which reads like a settings control rather than a way to sign in, and cannot
 * be sized to match the Google button. `useWalletModal` gives the same picker
 * behind a button we control.
 */
export function AlternateSignIn({
  onSuccess,
  referredBy,
}: {
  onSuccess: () => void;
  referredBy?: string | null;
}) {
  const { loginWithWallet, walletConnected, isBusy } = useAuth();
  const { setVisible } = useWalletModal();
  const [googleEnabled, setGoogleEnabled] = useState(false);

  /**
   * Set when the visitor clicked the wallet button while disconnected. Choosing
   * a wallet in the picker then continues straight into signing, instead of
   * making them click the same button a second time for no visible reason.
   */
  const awaitingConnection = useRef(false);

  useEffect(() => {
    void authApi.googleEnabled().then(setGoogleEnabled);
  }, []);

  const signIn = async () => {
    awaitingConnection.current = false;
    if (await loginWithWallet(referredBy)) onSuccess();
  };

  useEffect(() => {
    if (walletConnected && awaitingConnection.current) void signIn();
    // Intentionally keyed on connection only — `signIn` is stable enough here
    // and re-running on every render would re-trigger the signature prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletConnected]);

  const handleWallet = () => {
    if (walletConnected) {
      void signIn();
      return;
    }
    awaitingConnection.current = true;
    setVisible(true);
  };

  /** Shared so the two buttons cannot drift apart in size or weight. */
  const buttonClass =
    "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2";

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs uppercase tracking-wide text-gray-500">
            or continue with
          </span>
        </div>
      </div>

      {/* Two columns when Google is configured, one when it is not — so the
          wallet button fills the row rather than sitting oddly half-width. */}
      <div className={googleEnabled ? "grid grid-cols-2 gap-3" : "grid grid-cols-1"}>
        {googleEnabled && (
          <a href={googleSignInUrl()} className={buttonClass}>
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
              />
            </svg>
            Google
          </a>
        )}

        <button type="button" onClick={handleWallet} disabled={isBusy} className={buttonClass}>
          <svg
            className="h-[18px] w-[18px] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
            <path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
            <path d="M21 10.5v3.5h-3.75a1.75 1.75 0 1 1 0-3.5H21Z" />
          </svg>
          {isBusy ? "Waiting…" : "Wallet"}
        </button>
      </div>

      <p className="text-center text-xs text-gray-500">
        Signing in with a wallet creates an account instantly. You can add an email later.
      </p>
    </div>
  );
}
