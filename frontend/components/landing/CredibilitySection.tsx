"use client";

/**
 * Guarantees.
 *
 * The section doing the most persuasive work, so it gets the page's only
 * inversion: printed on receipt stock instead of the graphite desk. It reads as
 * a document — a statement of terms — rather than another row of feature cards.
 *
 * Every line maps to something CLAUDE.md marks `DONE`. Nothing about escrow,
 * mainnet, or audits appears, because none of that is true yet; the roadmap
 * section says so plainly instead.
 */

interface Guarantee {
  claim: string;
  mechanism: string;
  /** The concrete failure this prevents. Specificity is the persuasion. */
  prevents: string;
}

const GUARANTEES: Guarantee[] = [
  {
    claim: "A task can never pay out more than it was funded for",
    mechanism: "The 100-slot cap is enforced when a submission is written, not when it is read.",
    prevents: "Two workers racing for the last slot and both getting paid.",
  },
  {
    claim: "One payment funds exactly one task",
    mechanism: "A funding transaction's signature can only ever be used once.",
    prevents: "Replaying a single 0.1 SOL transfer to mint unlimited tasks.",
  },
  {
    claim: "A failed transfer cannot fund anything",
    mechanism: "Funding checks the transaction actually succeeded on chain, not just that it exists.",
    prevents: "A reverted transaction being counted as payment.",
  },
  {
    claim: "A retried withdrawal cannot pay twice",
    mechanism: "Your balance is debited before the transfer is broadcast, and restored if it fails.",
    prevents: "A network timeout becoming a double payout — or a lost balance.",
  },
  {
    claim: "Withdrawals go where you said, for what you said",
    mechanism: "You sign a message naming the exact amount and the destination wallet.",
    prevents: "An old signature being reused to authorise a larger withdrawal later.",
  },
  {
    claim: "Nothing happens without a record",
    mechanism: "Every sign-in, submission, and payout is written to an append-only log.",
    prevents: "Activity on your account that nobody can reconstruct afterwards.",
  },
];

export const CredibilitySection = () => {
  return (
    <section id="guarantees" className="dojo-slip">
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:py-24">
        <header className="mb-10 max-w-2xl">
          <p className="dojo-label mb-3" style={{ color: "var(--ink-dim)" }}>
            What we guarantee today
          </p>
          <h2 className="dojo-display text-[2rem] sm:text-[2.5rem]" style={{ color: "var(--ink)" }}>
            The boring parts, done properly
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
            Anyone can call a platform secure. These are the specific things that cannot
            happen here, and the specific reason each one cannot.
          </p>
        </header>

        {/* This genuinely is a table of terms, so it is set as one. */}
        <dl className="border-t" style={{ borderColor: "var(--slip-line)" }}>
          {GUARANTEES.map((item) => (
            <div
              key={item.claim}
              className="grid gap-2 border-b py-5 sm:grid-cols-[1.1fr_1fr] sm:gap-8"
              style={{ borderColor: "var(--slip-line)" }}
            >
              <dt className="flex gap-3">
                <span
                  className="dojo-mono mt-[3px] shrink-0 text-[13px]"
                  style={{ color: "var(--settled)" }}
                  aria-hidden
                >
                  ✓
                </span>
                <span
                  className="text-[15.5px] font-semibold leading-snug"
                  style={{ color: "var(--ink)" }}
                >
                  {item.claim}
                </span>
              </dt>
              <dd className="pl-7 sm:pl-0">
                <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                  {item.mechanism}
                </p>
                <p
                  className="dojo-mono mt-1.5 text-[11.5px] leading-relaxed"
                  style={{ color: "var(--ink-dim)" }}
                >
                  prevents: {item.prevents}
                </p>
              </dd>
            </div>
          ))}
        </dl>

        {/* The caveat gets the same weight as the guarantees rather than being
            buried in a footer — honesty is the persuasive move here. */}
        <div
          className="mt-8 rounded-[3px] border-l-[3px] p-5"
          style={{ borderColor: "var(--sol-deep)", backgroundColor: "rgba(212,83,12,0.06)" }}
        >
          <p className="dojo-label mb-2" style={{ color: "var(--sol-deep)" }}>
            What we do not claim
          </p>
          <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--ink)" }}>
            DojoPay runs on Solana <strong>devnet</strong>, and task funds are currently held
            by a platform wallet rather than a smart contract. That means you are trusting us
            with custody today. We think that is worth saying out loud — and it is the next
            thing we are fixing.
          </p>
          <a
            href="#roadmap"
            className="dojo-mono mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium underline underline-offset-4"
            style={{ color: "var(--sol-deep)" }}
          >
            See where that work stands
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </section>
  );
};
