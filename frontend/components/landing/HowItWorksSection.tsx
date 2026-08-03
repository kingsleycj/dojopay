"use client";

import { useEffect, useRef, useState } from "react";

/**
 * How it works — one continuous transaction, not three cards.
 *
 * The sequence is genuinely ordered (funding must clear before work can be
 * submitted; work must be recorded before it can be withdrawn), so a numbered
 * timeline encodes something true rather than decorating the layout. The
 * playhead advances on its own; hovering or focusing a step takes control so
 * someone can read at their own pace.
 */

interface Step {
  id: string;
  actor: "creator" | "worker" | "chain";
  title: string;
  detail: string;
  /** The machine-level fact behind the step. */
  trace: string;
}

const STEPS: Step[] = [
  {
    id: "fund",
    actor: "creator",
    title: "A task gets funded",
    detail:
      "The creator sends 0.1 SOL and uploads the images to choose between. Nothing goes live until that exact transaction is found on chain.",
    trace: "verify signature · 100,000,000 lamports · payer matches creator",
  },
  {
    id: "open",
    actor: "chain",
    title: "It opens for 100 answers",
    detail:
      "The task splits into a hundred slots worth 0.001 SOL each. That cap is the entire budget — there is no hundred-and-first slot to sell.",
    trace: "status OPEN · submissionCount 0/100",
  },
  {
    id: "submit",
    actor: "worker",
    title: "Someone picks an option",
    detail:
      "A worker opens the task, chooses, and is credited straight away. One answer per person per task, and the slot is claimed atomically so two people can never take the same one.",
    trace: "submission created · pending_amount += 1,000,000 lamports",
  },
  {
    id: "close",
    actor: "chain",
    title: "The task closes itself",
    detail:
      "When the hundredth answer lands, the task marks itself complete and stops accepting work. No manual step, and no way to overspend the budget.",
    trace: "status COMPLETED · 100/100",
  },
  {
    id: "withdraw",
    actor: "worker",
    title: "The worker withdraws",
    detail:
      "They sign a message naming the exact amount and destination. The balance is debited before the transfer is broadcast, and put back if it fails.",
    trace: "payout PROCESSING → SUCCESS · signature recorded",
  },
];

const ACTOR_LABEL: Record<Step["actor"], string> = {
  creator: "Creator",
  worker: "Worker",
  chain: "DojoPay",
};

export const HowItWorksSection = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Only run the playhead while the section is on screen, rather than animating
  // invisibly at the bottom of the page.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.25,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => setActive((current) => (current + 1) % STEPS.length), 3400);
    return () => clearInterval(timer);
  }, [inView, paused]);

  const takeControl = (index: number) => {
    setPaused(true);
    setActive(index);
  };

  return (
    <section id="how" ref={sectionRef} className="border-b" style={{ borderColor: "var(--desk-line)" }}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <header className="mb-12 max-w-xl">
          <p className="dojo-label mb-3" style={{ color: "var(--paper-dim)" }}>
            The whole loop
          </p>
          <h2 className="dojo-display text-[2rem] sm:text-[2.5rem]">One task, start to settled</h2>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-16">
          {/* Timeline rail */}
          <ol className="relative">
            <div
              className="absolute left-[9px] top-4 bottom-4 w-px"
              style={{ backgroundColor: "var(--desk-line)" }}
              aria-hidden
            />
            <div
              className="absolute left-[9px] top-4 w-px transition-[height] duration-500 ease-out"
              style={{
                backgroundColor: "var(--sol)",
                height: `calc(${((active + 1) / STEPS.length) * 100}% - 2rem)`,
              }}
              aria-hidden
            />

            {STEPS.map((step, index) => {
              const isActive = index === active;
              return (
                <li key={step.id} className="relative pl-8">
                  <button
                    onClick={() => takeControl(index)}
                    onMouseEnter={() => takeControl(index)}
                    onMouseLeave={() => setPaused(false)}
                    onFocus={() => takeControl(index)}
                    onBlur={() => setPaused(false)}
                    aria-current={isActive ? "step" : undefined}
                    className="w-full rounded-[3px] py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
                    style={
                      {
                        "--tw-ring-color": "var(--sol)",
                        "--tw-ring-offset-color": "var(--desk)",
                      } as React.CSSProperties
                    }
                  >
                    <span
                      className="absolute left-0 top-[1.75rem] block h-[19px] w-[19px] -translate-y-1/2 rounded-full border-2 transition-colors duration-300"
                      style={{
                        backgroundColor: isActive ? "var(--sol)" : "var(--desk)",
                        borderColor: isActive ? "var(--sol)" : "var(--desk-line)",
                      }}
                      aria-hidden
                    />
                    <span
                      className="dojo-label block transition-colors duration-300"
                      style={{ color: isActive ? "var(--sol)" : "var(--ink-dim)" }}
                    >
                      {ACTOR_LABEL[step.actor]}
                    </span>
                    <span
                      className="mt-1 block text-[15px] font-semibold transition-colors duration-300"
                      style={{ color: isActive ? "var(--slip)" : "var(--paper-dim)" }}
                    >
                      {step.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Detail panel. Fixed min-height so advancing a step never reflows
              the page under the reader. */}
          <div
            className="relative rounded-[3px] border p-6 sm:p-8"
            style={{
              borderColor: "var(--desk-line)",
              backgroundColor: "var(--desk-raised)",
              minHeight: "17rem",
            }}
          >
            <span className="dojo-mono text-[11px]" style={{ color: "var(--paper-dim)" }}>
              step {active + 1} of {STEPS.length}
            </span>

            <p
              key={STEPS[active].id}
              className="dojo-print mt-4 text-[1.1rem] leading-relaxed sm:text-[1.28rem]"
              style={{ color: "var(--slip)" }}
            >
              {STEPS[active].detail}
            </p>

            <div className="mt-8 border-t pt-4" style={{ borderColor: "var(--desk-line)" }}>
              <span className="dojo-label mb-2 block" style={{ color: "var(--ink-dim)" }}>
                what actually happens
              </span>
              <code
                className="dojo-mono block text-[11.5px] leading-relaxed"
                style={{ color: "var(--settled)" }}
              >
                {STEPS[active].trace}
              </code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
