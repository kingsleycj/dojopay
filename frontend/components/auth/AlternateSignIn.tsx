"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { authApi, googleSignInUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Google and wallet sign-in, shared by the login and register screens.
 *
 * Wallet stays a first-class option — DojoPay is non-custodial and some users
 * arrive already holding one — but it is presented after email, because for a
 * new worker "install a wallet extension" is the single biggest drop-off in the
 * funnel.
 */
export function AlternateSignIn({
  onSuccess,
  referredBy,
}: {
  onSuccess: () => void;
  referredBy?: string | null;
}) {
  const { loginWithWallet, walletConnected, isBusy } = useAuth();
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Hidden entirely when the backend has no Google credentials configured,
  // rather than offering a button that leads to an error page.
  useEffect(() => {
    void authApi.googleEnabled().then(setGoogleEnabled);
  }, []);

  const handleWallet = async () => {
    if (await loginWithWallet(referredBy)) onSuccess();
  };

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

      {googleEnabled && (
        <a
          href={googleSignInUrl()}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
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

      {walletConnected ? (
        <button
          onClick={handleWallet}
          disabled={isBusy}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Sign a message with your wallet
        </button>
      ) : (
        <div className="flex justify-center [&_.wallet-adapter-button]:w-full [&_.wallet-adapter-button]:justify-center">
          <WalletMultiButton />
        </div>
      )}

      <p className="text-center text-xs text-gray-500">
        Signing in with a wallet creates an account instantly. You can add an email later.
      </p>
    </div>
  );
}
