"use client";

import { LiveReceipt } from "./LiveReceipt";

type HeroSectionProps = {
  onGetStarted?: () => void;
  onJoinAsWorker?: () => void;
};

/**
 * Hero.
 *
 * The thesis is the receipt, not the headline — a visitor should understand
 * "money goes in, is split into small verified payments, and adds up exactly"
 * before reading a word. The copy's job is only to say who it is for and what
 * the numbers are.
 */
export const HeroSection = ({ onGetStarted, onJoinAsWorker }: HeroSectionProps) => {
  return (
    <section className="relative overflow-hidden border-b dojo-rule">
      {/* Ledger ruling bleeding off the top — the page's background material,
          not decoration for its own sake. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent 39px, var(--desk-line) 39px, var(--desk-line) 40px)",
          maskImage: "linear-gradient(to bottom, #000 0%, transparent 72%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 72%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-24">
        {/* Left: the claim */}
        <div>
          <p className="dojo-label mb-6 flex flex-wrap items-center gap-2" style={{ color: "var(--paper-dim)" }}>
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--sol)" }}
              aria-hidden
            />
            Solana devnet · live
          </p>

          <h1 className="dojo-display text-[2.75rem] sm:text-[3.75rem] lg:text-[4.25rem]">
            Small work.
            <br />
            <span style={{ color: "var(--sol)" }}>Exact pay.</span>
          </h1>

          <p
            className="mt-6 max-w-md text-[1.0625rem] leading-relaxed"
            style={{ color: "var(--paper-dim)" }}
          >
            Creators fund a task with 0.1 SOL. A hundred people each answer it once and
            earn 0.001 SOL. Every payment is checked against the chain before it
            counts — and the books always balance.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onJoinAsWorker}
              className="group inline-flex items-center justify-center gap-2 rounded-[3px] px-6 py-3.5 text-[15px] font-semibold transition-transform duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor: "var(--sol)",
                color: "var(--ink)",
                // @ts-expect-error CSS custom property for the focus ring
                "--tw-ring-color": "var(--sol)",
                "--tw-ring-offset-color": "var(--desk)",
              }}
            >
              Start earning
              <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">
                →
              </span>
            </button>

            <button
              onClick={onGetStarted}
              className="inline-flex items-center justify-center rounded-[3px] border px-6 py-3.5 text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                borderColor: "var(--desk-line)",
                color: "var(--slip)",
                // @ts-expect-error CSS custom property for the focus ring
                "--tw-ring-color": "var(--slip)",
                "--tw-ring-offset-color": "var(--desk)",
              }}
            >
              Post a task
            </button>
          </div>

          <p className="dojo-mono mt-5 text-[11.5px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
            Sign up with email, Google, or a wallet. You only need a wallet when you
            withdraw.
          </p>
        </div>

        {/* Right: the proof */}
        <div className="lg:pl-4">
          <LiveReceipt />
        </div>
      </div>
    </section>
  );
};
