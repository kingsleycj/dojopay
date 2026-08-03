"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ToastContainer } from "@/components/Toast";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { CredibilitySection } from "@/components/landing/CredibilitySection";
import { BuiltForEveryoneSection } from "@/components/landing/BuiltForEveryoneSection";
import { WhySolanaSection } from "@/components/landing/WhySolanaSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { useAuth } from "@/lib/auth";

/**
 * Landing page.
 *
 * Section order is an argument, not a template: show the loop working (hero),
 * explain it (how), prove it is safe (guarantees), say who it is for
 * (audience), admit what is unfinished (roadmap), then ask (CTA). The
 * guarantees and CTA sections invert to receipt stock so the page alternates
 * material rather than repeating one card rhythm four times.
 */
function Landing() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, isAuthenticated, mode } = useAuth();

  const referredBy = searchParams?.get("ref") ?? null;
  const next = searchParams?.get("next") ?? null;

  // Already signed in: go straight to the dashboard for the current mode.
  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace(
        next && next.startsWith("/") && !next.startsWith("//") ? next : `/${mode}/dashboard`,
      );
    }
  }, [isReady, isAuthenticated, router, mode, next]);

  /**
   * Top of the Phase 5 share funnel. `next` carries a shared task through
   * sign-up so the visitor lands back on it, and `ref` attributes the referral —
   * both must survive every CTA on this page.
   */
  const authLink = (path: "login" | "register") => {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (referredBy) params.set("ref", referredBy);
    const query = params.toString();
    return `/auth/${path}${query ? `?${query}` : ""}`;
  };

  const goRegister = () => router.push(authLink("register"));
  const goLogin = () => router.push(authLink("login"));

  if (isReady && isAuthenticated) {
    return (
      <div className="dojo flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-b-2"
          style={{ borderColor: "var(--sol)" }}
        />
      </div>
    );
  }

  return (
    <div id="top" className="dojo min-h-screen">
      <ToastContainer />
      <Navbar onGetStarted={goRegister} onSignIn={goLogin} />

      <main>
        <HeroSection onGetStarted={goRegister} onJoinAsWorker={goRegister} />
        <HowItWorksSection />
        <CredibilitySection />
        <BuiltForEveryoneSection />
        <WhySolanaSection />
        <CTASection onGetStarted={goRegister} onJoinAsWorker={goRegister} />
      </main>

      <Footer />
    </div>
  );
}

export default function Page() {
  // `useSearchParams` requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="dojo min-h-screen" />}>
      <Landing />
    </Suspense>
  );
}
