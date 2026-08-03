"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { authApi, clearTokens, getToken, setToken } from "@/lib/api";

/**
 * Auth state for the whole app.
 *
 * Replaces the previous approach, where six different pages each ran
 * `setInterval(checkLocalStorage, 1000)` to notice sign-in changes. Token
 * writes now dispatch a `dojopay:auth-changed` event and everything re-reads
 * from one source.
 */

export type Role = "creator" | "worker";

interface AuthState {
  role: Role | null;
  walletAddress: string | null;
  isConnected: boolean;
  isSigningIn: boolean;
  /** False until the first client-side read of localStorage completes. */
  isReady: boolean;
  signIn: (role: Role, options?: { referredBy?: string | null }) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readRole(): Role | null {
  if (getToken("creator")) return "creator";
  if (getToken("worker")) return "worker";
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, signMessage, disconnect } = useWallet();
  const [role, setRole] = useState<Role | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const walletAddress = publicKey?.toBase58() ?? null;

  const refresh = useCallback(() => setRole(readRole()), []);

  // Initial read plus subscriptions. `storage` covers other tabs; the custom
  // event covers this one.
  useEffect(() => {
    refresh();
    setIsReady(true);

    window.addEventListener("dojopay:auth-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("dojopay:auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  // A disconnected wallet cannot own a session.
  useEffect(() => {
    if (isReady && !publicKey) {
      clearTokens();
      setRole(null);
    }
  }, [publicKey, isReady]);

  const signIn = useCallback(
    async (nextRole: Role, options?: { referredBy?: string | null }) => {
      if (!publicKey || !signMessage) return false;

      // Already holding a token for this role.
      if (getToken(nextRole)) {
        setRole(nextRole);
        return true;
      }

      setIsSigningIn(true);
      try {
        const message = new TextEncoder().encode(
          nextRole === "creator"
            ? "Sign into DojoPay as a creator"
            : "Sign into DojoPay as a worker",
        );
        const signature = await signMessage(message);
        const address = publicKey.toBase58();

        const result =
          nextRole === "creator"
            ? await authApi.signInCreator(address, Array.from(signature))
            : await authApi.signInWorker(address, Array.from(signature), options?.referredBy);

        setToken(nextRole, result.token);
        setRole(nextRole);
        return true;
      } catch (error) {
        console.error("Sign-in failed", error);
        return false;
      } finally {
        setIsSigningIn(false);
      }
    },
    [publicKey, signMessage],
  );

  const signOut = useCallback(() => {
    clearTokens();
    setRole(null);
    void disconnect();
  }, [disconnect]);

  const value = useMemo<AuthState>(
    () => ({
      role,
      walletAddress,
      isConnected: Boolean(publicKey),
      isSigningIn,
      isReady,
      signIn,
      signOut,
    }),
    [role, walletAddress, publicKey, isSigningIn, isReady, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}
