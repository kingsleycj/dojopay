"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * Landing point for the Google OAuth redirect.
 *
 * The backend puts the token in the URL *fragment* rather than the query
 * string: fragments are never sent to servers, so the session token cannot end
 * up in access logs or a Referer header. Fragments are also unavailable during
 * SSR, so this has to read it after mount.
 */
function OAuthCallback() {
  const router = useRouter();
  const { adoptSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token");
    const welcome = params.get("welcome") === "1";

    if (!token) {
      setError("That sign-in link is missing its token. Please try again.");
      return;
    }

    void adoptSession(token)
      .then(() => {
        // Strip the token from history so the back button cannot resurface it.
        window.history.replaceState(null, "", window.location.pathname);
        router.replace(welcome ? "/settings?welcome=1" : "/worker/dashboard");
      })
      .catch(() => setError("We could not complete sign-in. Please try again."));
  }, [adoptSession, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-800">{error}</p>
          <a href="/auth/login" className="mt-4 inline-block text-sm font-semibold text-red-900 underline">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97316] mx-auto" />
        <p className="mt-4 text-sm text-gray-600">Signing you in…</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <OAuthCallback />
    </Suspense>
  );
}
