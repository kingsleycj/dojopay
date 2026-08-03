"use client";

type CTASectionProps = {
  onGetStarted?: () => void;
  onJoinAsWorker?: () => void;
};

/**
 * Closing CTA.
 *
 * Buttons wired to the same sign-up funnel as the hero — the previous version
 * used `href="#"` on both, so neither did anything. Set on receipt stock to
 * bookend the guarantees section and close the page on paper rather than desk.
 */
export const CTASection = ({ onGetStarted, onJoinAsWorker }: CTASectionProps) => {
  return (
    <section className="dojo-slip">
      {/* Same max width and padding as every other section, so the left rag of
          the page stays unbroken. The copy is constrained separately below. */}
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <p className="dojo-label mb-3" style={{ color: "var(--ink-dim)" }}>
          Two ways to start
        </p>

        <h2 className="dojo-display text-[2.25rem] sm:text-[2.9rem]" style={{ color: "var(--ink)" }}>
          Pick a side of the ledger.
        </h2>

        <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          Earning takes an email and about thirty seconds. Posting a task takes 0.1 SOL on
          devnet and a wallet to fund it from.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onJoinAsWorker}
            className="group inline-flex items-center justify-center gap-2 rounded-[3px] px-6 py-3.5 text-[15px] font-semibold transition-transform duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={
              {
                backgroundColor: "var(--ink)",
                color: "var(--slip)",
                "--tw-ring-color": "var(--ink)",
                "--tw-ring-offset-color": "var(--slip)",
              } as React.CSSProperties
            }
          >
            Start earning
            <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">
              →
            </span>
          </button>

          <button
            onClick={onGetStarted}
            className="inline-flex items-center justify-center rounded-[3px] border px-6 py-3.5 text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={
              {
                borderColor: "var(--slip-line)",
                color: "var(--ink)",
                "--tw-ring-color": "var(--ink)",
                "--tw-ring-offset-color": "var(--slip)",
              } as React.CSSProperties
            }
          >
            Post a task
          </button>
        </div>

        <p className="dojo-mono mt-6 text-[11.5px]" style={{ color: "var(--ink-dim)" }}>
          Devnet only. No real funds are at stake yet.
        </p>
      </div>
    </section>
  );
};
