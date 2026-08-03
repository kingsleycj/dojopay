"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ToastContainer } from "@/components/Toast";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { CredibilitySection } from "@/components/landing/CredibilitySection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { BuiltForEveryoneSection } from "@/components/landing/BuiltForEveryoneSection";
import { WhySolanaSection } from "@/components/landing/WhySolanaSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { useAuth } from "@/lib/auth";

/**
 * Landing page.
 *
 * Sign-in now lives on dedicated `/auth/*` routes rather than a modal here.
 * With email, Google, and wallet options plus verification and reset flows,
 * a modal could no longer hold the whole surface — and real pages are
 * linkable, which the share flow depends on.
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
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : `/${mode}/dashboard`);
    }
  }, [isReady, isAuthenticated, router, mode, next]);

  const authLink = (path: "login" | "register") => {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (referredBy) params.set("ref", referredBy);
    const query = params.toString();
    return `/auth/${path}${query ? `?${query}` : ""}`;
  };

  if (isReady && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer />
      <Navbar onGetStarted={() => router.push(authLink("register"))} />

      <div className="flex-grow">
        <HeroSection
          onGetStarted={() => router.push(authLink("register"))}
          onJoinAsWorker={() => router.push(authLink("register"))}
        />
        <CredibilitySection />
        <HowItWorksSection />
        <BuiltForEveryoneSection />
        <WhySolanaSection />
        <CTASection />
      </div>

      <Footer />
    </div>
  );
}

export default function Page() {
  // `useSearchParams` requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <Landing />
    </Suspense>
  );
}
