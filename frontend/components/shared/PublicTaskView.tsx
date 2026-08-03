"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock, Users, Wallet } from "lucide-react";
import { CountdownTimer } from "@/components/CountdownTimer";
import { ShareButton } from "@/components/shared/ShareButton";
import { useAuth } from "@/lib/auth";
import { lamportsToSol } from "@/utils/convert";
import type { PublicTask } from "@/lib/api/types";

/**
 * What a share-link recipient sees.
 *
 * Three audiences land here and each needs a different next step:
 *  - an existing worker, who should go straight to the task;
 *  - a signed-out visitor with a wallet, who needs one signature;
 *  - someone with no wallet at all, who needs to be told what that means
 *    before being thrown at a wallet modal.
 */
export function PublicTaskView({ task }: { task: PublicTask }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isReady, mode } = useAuth();
  const [mounted, setMounted] = useState(false);

  const referrer = searchParams?.get("ref") ?? null;

  useEffect(() => setMounted(true), []);

  const reward = lamportsToSol(task.rewardLamports);
  const filled = task.maxSubmissions - task.spotsRemaining;
  const progress = (filled / task.maxSubmissions) * 100;

  /**
   * One account covers both modes, so a signed-in visitor always goes straight
   * to the task. Everyone else is sent to sign-up with the task preserved as
   * `next`, so they land back here rather than on a generic dashboard.
   */
  const handleStart = () => {
    if (isAuthenticated) {
      router.push("/worker/tasks");
      return;
    }

    const params = new URLSearchParams({ next: `/task/${task.id}` });
    if (referrer) params.set("ref", referrer);
    router.push(`/auth/register?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <a href="/" className="font-bold text-lg">
            DojoPay
          </a>
          <ShareButton
            taskId={task.id}
            title={task.title}
            rewardSol={reward.toString()}
            referrer={referrer}
            variant="icon"
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {task.previewImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-gray-100">
              {task.previewImages.slice(0, 4).map((image, index) => (
                <div key={index} className="aspect-square">
                  <img
                    src={image}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold text-[#f97316]">{reward}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">SOL reward</div>
              </div>
            </div>

            {!task.isOpen ? (
              <div className="rounded-lg bg-gray-100 border border-gray-200 p-4 text-sm text-gray-700">
                This task is no longer accepting submissions — but new ones are posted
                regularly.
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {task.spotsRemaining} of {task.maxSubmissions} spots left
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-[#f97316] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {task.expiresAt && mounted && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <CountdownTimer expiresAt={task.expiresAt} compact />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStart}
                  disabled={!isReady}
                  className="w-full rounded-xl bg-[#f97316] px-6 py-3 font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50 transition-colors"
                >
                  {isAuthenticated ? "Open this task" : "Start earning — it takes a minute"}
                </button>

                {!isAuthenticated && (
                  <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <Wallet className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 mb-1">New here?</p>
                        {/* Sign-up needs only an email; the wallet is deferred
                            until withdrawal, which is what keeps this funnel
                            from dying at "install a browser extension". */}
                        <p className="text-gray-600">
                          Sign up with an email or Google and start straight away. You will
                          connect a Solana wallet when you are ready to withdraw — that is
                          where your SOL gets paid, and DojoPay never holds your keys.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          <a href="/" className="text-[#f97316] hover:underline">
            Browse other tasks on DojoPay
          </a>
        </p>
      </main>
    </div>
  );
}
