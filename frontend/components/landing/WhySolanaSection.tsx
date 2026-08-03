"use client";

/**
 * Roadmap — replaces the old "Why Solana" card grid.
 *
 * That section asserted three generic virtues ("Fast. Low fees. Scales.") that
 * are true of Solana and say nothing about DojoPay. This says something only we
 * can say: exactly what is shipped, what is being built, and what is not done —
 * including that the escrow program is written but neither deployed nor audited.
 *
 * Statuses track CLAUDE.md §7. If a phase marker changes there, change it here.
 */

type Status = "live" | "building" | "next";

interface Milestone {
  status: Status;
  title: string;
  detail: string;
}

const MILESTONES: Milestone[] = [
  {
    status: "live",
    title: "The marketplace works end to end",
    detail:
      "Fund a task, collect a hundred answers, withdraw to your wallet. Running on devnet with the guarantees above enforced.",
  },
  {
    status: "live",
    title: "Sign up without a wallet",
    detail:
      "Email, Google, or wallet. A wallet is only required at withdrawal, so nobody has to install an extension to try the product.",
  },
  {
    status: "building",
    title: "Moving custody on chain",
    detail:
      "An Anchor escrow program that holds each task's funds in its own account, so workers claim directly and we never hold the money. Written, compiling, and unit-tested — but not deployed, not audited, and not carrying a single lamport yet.",
  },
  {
    status: "next",
    title: "Mainnet",
    detail:
      "After the escrow program has been through integration testing against a validator and an external review. We are not going to rush this one.",
  },
];

const STATUS_META: Record<Status, { label: string; color: string; fill: string }> = {
  live: { label: "Live", color: "var(--settled)", fill: "var(--settled)" },
  building: { label: "In progress", color: "var(--sol)", fill: "var(--sol)" },
  next: { label: "Not started", color: "var(--paper-dim)", fill: "transparent" },
};

export const WhySolanaSection = () => {
  return (
    <section id="roadmap" className="border-b" style={{ borderColor: "var(--desk-line)" }}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <header className="mb-12 max-w-2xl">
          <p className="dojo-label mb-3" style={{ color: "var(--paper-dim)" }}>
            Where this is going
          </p>
          <h2 className="dojo-display text-[2rem] sm:text-[2.5rem]">
            Shipped, building, and not yet started
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed" style={{ color: "var(--paper-dim)" }}>
            Published because a marketplace holding your money should be legible about what it
            has actually finished.
          </p>
        </header>

        <ol className="grid gap-px overflow-hidden rounded-[3px] sm:grid-cols-2" style={{ backgroundColor: "var(--desk-line)" }}>
          {MILESTONES.map((milestone) => {
            const meta = STATUS_META[milestone.status];
            return (
              <li
                key={milestone.title}
                className="p-6 sm:p-7"
                style={{ backgroundColor: "var(--desk-raised)" }}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className="block h-2.5 w-2.5 rounded-full border-2"
                    style={{ borderColor: meta.color, backgroundColor: meta.fill }}
                    aria-hidden
                  />
                  <span className="dojo-label" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                </div>

                <h3 className="text-[1.05rem] font-semibold" style={{ color: "var(--slip)" }}>
                  {milestone.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--paper-dim)" }}>
                  {milestone.detail}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
