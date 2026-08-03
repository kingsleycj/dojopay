"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WalletDisconnectButton, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ToastContainer } from "@/components/Toast";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { CredibilitySection } from "@/components/landing/CredibilitySection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { BuiltForEveryoneSection } from "@/components/landing/BuiltForEveryoneSection";
import { WhySolanaSection } from "@/components/landing/WhySolanaSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { useAuth, type Role } from "@/lib/auth";

/**
 * Landing page and sign-in funnel.
 *
 * Accepts three query parameters so a share link survives the wallet-connect
 * detour: `role` preselects creator/worker, `next` is where to land after
 * signing in, and `ref` attributes the referral. Previously sign-in always
 * dumped you on a dashboard, so a shared task link lost the task.
 */
function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, isConnected, isReady, isSigningIn, signIn, walletAddress } = useAuth();

  const requestedRole = (searchParams?.get("role") ?? null) as Role | null;
  const next = searchParams?.get("next") ?? null;
  const referrer = searchParams?.get("ref") ?? null;

  const [authOpen, setAuthOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const destinationFor = useCallback(
    (target: Role) => {
      // Only accept same-origin relative paths — an attacker-supplied absolute
      // URL here would be an open redirect.
      if (next && next.startsWith("/") && !next.startsWith("//")) return next;
      return `/${target}/dashboard`;
    },
    [next],
  );

  // A share link that names a role opens the modal straight onto that step.
  useEffect(() => {
    if (requestedRole === "creator" || requestedRole === "worker") {
      setAuthOpen(true);
      setSelectedRole(requestedRole);
    }
  }, [requestedRole]);

  // Already signed in: go where they were headed.
  useEffect(() => {
    if (!isReady || !role) return;
    router.replace(destinationFor(role));
  }, [isReady, role, router, destinationFor]);

  // Wallet connected and a role chosen — request the signature.
  useEffect(() => {
    if (!authOpen || !selectedRole || !isConnected || isSigningIn || role) return;

    void (async () => {
      const ok = await signIn(selectedRole, { referredBy: referrer });
      if (ok) {
        setAuthOpen(false);
        router.push(destinationFor(selectedRole));
      }
    })();
  }, [
    authOpen,
    selectedRole,
    isConnected,
    isSigningIn,
    role,
    signIn,
    referrer,
    router,
    destinationFor,
  ]);

  const openAuth = (target?: Role) => {
    setAuthOpen(true);
    setSelectedRole(target ?? null);
  };

  const closeAuth = () => {
    if (isSigningIn) return;
    setAuthOpen(false);
    setSelectedRole(null);
  };

  if (isReady && role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer />
      <Navbar onGetStarted={() => openAuth()} />

      <div className="flex-grow">
        <HeroSection onGetStarted={() => openAuth()} onJoinAsWorker={() => openAuth("worker")} />
        <CredibilitySection />
        <HowItWorksSection />
        <BuiltForEveryoneSection />
        <WhySolanaSection />
        <CTASection />
      </div>

      <Footer />

      {authOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to DojoPay</h2>
              <p className="text-gray-600 text-sm">
                {next
                  ? "Sign in to continue to the task you opened"
                  : "Choose a role, then connect your wallet to sign in"}
              </p>
            </div>

            {!selectedRole ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedRole("creator")}
                  className="rounded-xl border border-gray-200 hover:border-gray-900/20 hover:bg-gray-50 hover:-translate-y-0.5 transition-all p-4 text-left"
                >
                  <div className="text-lg font-semibold text-gray-900 mb-1">Creator</div>
                  <div className="text-sm text-gray-600">Post tasks and manage payouts</div>
                </button>
                <button
                  onClick={() => setSelectedRole("worker")}
                  className="rounded-xl border border-gray-200 hover:border-gray-900/20 hover:bg-gray-50 hover:-translate-y-0.5 transition-all p-4 text-left"
                >
                  <div className="text-lg font-semibold text-gray-900 mb-1">Worker</div>
                  <div className="text-sm text-gray-600">Complete tasks and earn instantly</div>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-900">Signing in as</div>
                  <div className="text-sm text-gray-600 mt-1 capitalize">{selectedRole}</div>
                </div>

                {!isConnected ? (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-sm text-gray-700 mb-3">
                      Connect your wallet to continue. DojoPay never holds your keys.
                    </div>
                    <div className="flex justify-center">
                      <WalletMultiButton />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-sm text-gray-700">Wallet connected</div>
                    <div className="text-xs text-gray-500 font-mono mt-1 break-all">
                      {walletAddress}
                    </div>
                    <div className="mt-3 flex justify-center">
                      <WalletDisconnectButton />
                    </div>
                  </div>
                )}

                {isSigningIn && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316]" />
                    <p className="text-xs text-gray-500">Approve the signature in your wallet</p>
                  </div>
                )}

                <div className="flex justify-between gap-3">
                  <button
                    onClick={() => setSelectedRole(null)}
                    disabled={isSigningIn}
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={closeAuth}
                    disabled={isSigningIn}
                    className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!selectedRole && (
              <div className="mt-5 flex justify-center">
                <button onClick={closeAuth} className="text-sm text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  // `useSearchParams` requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LandingPage />
    </Suspense>
  );
}
