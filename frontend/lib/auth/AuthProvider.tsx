"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  authApi,
  clearLegacyTokens,
  clearToken,
  getToken,
  setToken,
  type Account,
} from "@/lib/api";

/**
 * Auth state for the whole app.
 *
 * One account session, not one per role. `mode` is a client-side view
 * preference for which dashboard to show — switching it does not touch the
 * server, because the same session already authorises both. Profiles are
 * created lazily by the API the first time the account acts in a role.
 */

export type Mode = "creator" | "worker";

const MODE_KEY = "dojopay.mode";

interface AuthState {
  account: Account | null;
  isAuthenticated: boolean;
  /** False until the first client-side session check completes. */
  isReady: boolean;
  isBusy: boolean;

  /** Which dashboard the user is currently looking at. */
  mode: Mode;
  setMode: (mode: Mode) => void;

  /** Wallet connection state, independent of being signed in. */
  walletConnected: boolean;
  walletAddress: string | null;

  refresh: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (input: {
    email: string;
    password: string;
    displayName?: string;
    referredBy?: string | null;
  }) => Promise<boolean>;
  loginWithWallet: (referredBy?: string | null) => Promise<boolean>;
  linkWallet: () => Promise<boolean>;
  adoptSession: (token: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, signMessage, disconnect } = useWallet();
  const [account, setAccount] = useState<Account | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [mode, setModeState] = useState<Mode>("worker");
  const [error, setError] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() ?? null;

  const refresh = useCallback(async () => {
    if (!getToken("account")) {
      setAccount(null);
      return;
    }
    try {
      setAccount(await authApi.me());
    } catch {
      // An invalid token is cleared by the client interceptor; treat as signed out.
      setAccount(null);
    }
  }, []);

  // Initial load, plus cross-tab and same-tab session changes.
  useEffect(() => {
    clearLegacyTokens();

    const stored = window.localStorage.getItem(MODE_KEY);
    if (stored === "creator" || stored === "worker") setModeState(stored);

    void refresh().finally(() => setIsReady(true));

    const onChange = () => void refresh();
    window.addEventListener("dojopay:auth-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("dojopay:auth-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    window.localStorage.setItem(MODE_KEY, next);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  /** Adopt a token minted elsewhere — the Google OAuth callback. */
  const adoptSession = useCallback(
    async (token: string) => {
      setToken("account", token);
      await refresh();
    },
    [refresh],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      setIsBusy(true);
      setError(null);
      try {
        const result = await authApi.login({ email, password });
        setToken("account", result.token);
        setAccount(result.account);
        return true;
      } catch (err: any) {
        setError(err?.message ?? "Could not sign in");
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  const registerWithEmail = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName?: string;
      referredBy?: string | null;
    }) => {
      setIsBusy(true);
      setError(null);
      try {
        const result = await authApi.register(input);
        setToken("account", result.token);
        setAccount(result.account);
        return true;
      } catch (err: any) {
        setError(err?.message ?? "Could not create your account");
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  /**
   * Wallet sign-in.
   *
   * The nonce comes from the server and is embedded in the signed message, so a
   * signature captured from one sign-in cannot be replayed.
   */
  const loginWithWallet = useCallback(
    async (referredBy?: string | null) => {
      if (!publicKey || !signMessage) {
        setError("Connect your wallet first");
        return false;
      }

      setIsBusy(true);
      setError(null);
      try {
        const challenge = await authApi.walletChallenge("signin");
        const signature = await signMessage(new TextEncoder().encode(challenge.message));

        const result = await authApi.walletAuth({
          walletAddress: publicKey.toBase58(),
          signature: Array.from(signature),
          nonce: challenge.nonce,
          referredBy,
        });

        setToken("account", result.token);
        setAccount(result.account);
        return true;
      } catch (err: any) {
        setError(
          isUserRejection(err) ? "Signature cancelled" : (err?.message ?? "Could not sign in"),
        );
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [publicKey, signMessage],
  );

  /** Attach a wallet to an existing email/Google account — the withdrawal gate. */
  const linkWallet = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Connect your wallet first");
      return false;
    }

    setIsBusy(true);
    setError(null);
    try {
      const challenge = await authApi.walletChallenge("link");
      const signature = await signMessage(new TextEncoder().encode(challenge.message));

      const updated = await authApi.linkWallet({
        walletAddress: publicKey.toBase58(),
        signature: Array.from(signature),
        nonce: challenge.nonce,
      });

      setAccount(updated);
      return true;
    } catch (err: any) {
      setError(
        isUserRejection(err) ? "Signature cancelled" : (err?.message ?? "Could not link wallet"),
      );
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [publicKey, signMessage]);

  const signOut = useCallback(() => {
    // Best-effort: the audit entry is nice to have, the local sign-out is not
    // conditional on it.
    void authApi.logout().catch(() => undefined);
    clearToken("account");
    setAccount(null);
    void disconnect().catch(() => undefined);
  }, [disconnect]);

  const value = useMemo<AuthState>(
    () => ({
      account,
      isAuthenticated: Boolean(account),
      isReady,
      isBusy,
      mode,
      setMode,
      walletConnected: Boolean(publicKey),
      walletAddress,
      refresh,
      loginWithEmail,
      registerWithEmail,
      loginWithWallet,
      linkWallet,
      adoptSession,
      signOut,
      error,
      clearError,
    }),
    [
      account,
      isReady,
      isBusy,
      mode,
      setMode,
      publicKey,
      walletAddress,
      refresh,
      loginWithEmail,
      registerWithEmail,
      loginWithWallet,
      linkWallet,
      adoptSession,
      signOut,
      error,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Dismissing a wallet prompt is a cancellation, not a failure worth shouting about. */
function isUserRejection(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? "";
  const name = (error as { name?: string })?.name ?? "";
  return name.includes("WalletSignMessageError") || /reject|denied|cancel/i.test(message);
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
