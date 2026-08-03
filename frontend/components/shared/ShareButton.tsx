"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { showToast } from "@/components/Toast";

/**
 * Share a task.
 *
 * The link points at the public `/task/[id]` page, which renders without a
 * session — so a recipient who has never used DojoPay sees the task first and
 * is asked to sign up second. `ref` carries the sharer's wallet address for
 * attribution, and `next` is preserved through the wallet-connect detour by
 * the landing page.
 */

interface ShareButtonProps {
  taskId: number;
  title: string;
  /** Sharer's wallet address, recorded as the referrer on new worker accounts. */
  referrer?: string | null;
  /** Reward per submission in SOL, used in the share copy. */
  rewardSol?: string;
  variant?: "button" | "icon";
}

export function ShareButton({
  taskId,
  title,
  referrer,
  rewardSol,
  variant = "button",
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Built on the client: `window.location.origin` is not available during SSR.
  useEffect(() => {
    const url = new URL(`/task/${taskId}`, window.location.origin);
    if (referrer) url.searchParams.set("ref", referrer);
    setShareUrl(url.toString());
  }, [taskId, referrer]);

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shareText = rewardSol
    ? `Earn ${rewardSol} SOL for a quick task on DojoPay: "${title}"`
    : `Complete this task on DojoPay and get paid in SOL: "${title}"`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy the link", "error");
    }
  };

  const handleClick = async () => {
    // Prefer the OS share sheet where it exists — on mobile that is the whole
    // interaction, and it reaches apps a link menu never could.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
        return;
      } catch (error: any) {
        // AbortError means the user dismissed the sheet; not a failure.
        if (error?.name === "AbortError") return;
      }
    }
    setOpen((value) => !value);
  };

  const targets = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleClick}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          variant === "icon"
            ? "p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            : "inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        }
      >
        <Share2 className="w-4 h-4" />
        {variant === "button" && <span className="font-medium">Share</span>}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
        >
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-2 mb-2">
            <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-600 truncate flex-1">{shareUrl}</span>
            <button
              onClick={copyLink}
              className="text-xs font-semibold text-[#f97316] hover:text-[#ea580c] flex items-center gap-1 flex-shrink-0"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {targets.map((target) => (
              <a
                key={target.label}
                href={target.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="text-center text-xs font-medium text-gray-700 rounded-lg border border-gray-200 py-2 hover:bg-gray-50"
              >
                {target.label}
              </a>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            Anyone can open this link. New workers are walked through creating an
            account before they see the task.
          </p>
        </div>
      )}
    </div>
  );
}
