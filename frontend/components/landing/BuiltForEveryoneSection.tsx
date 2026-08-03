"use client";

/**
 * Who it's for.
 *
 * Three real audiences in three different registers, because they are reading
 * for different things: a worker wants to know what they'll actually clear, a
 * creator wants to know what they get back, a builder wants to know how it is
 * put together. Deliberately asymmetric — the worker column is widest and leads,
 * because that is the side of the marketplace that has to fill.
 */

const CREATOR_POINTS = [
  "Results as they arrive, with per-option vote counts",
  "Set an expiry, or leave it open until the slots fill",
  "Share a task by link — it works for people with no account",
];

const BUILDER_POINTS: Array<[term: string, definition: string]> = [
  ["Auth", "Wallet signature or email — one session, roles resolved server-side"],
  ["Ledger", "Lamports as BigInt end to end; strings on the wire, never floats"],
  ["Escrow", "Anchor program written and tested, not yet deployed"],
];

export const BuiltForEveryoneSection = () => {
  return (
    <section id="audience" className="border-b" style={{ borderColor: "var(--desk-line)" }}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <header className="mb-12 max-w-xl">
          <p className="dojo-label mb-3" style={{ color: "var(--paper-dim)" }}>
            Who it&apos;s for
          </p>
          <h2 className="dojo-display text-[2rem] sm:text-[2.5rem]">Three ways in</h2>
        </header>

        {/* 1px gaps over a line-coloured background give hairline dividers
            between panels without six separate borders to keep in sync. */}
        <div
          className="grid gap-px overflow-hidden rounded-[3px] lg:grid-cols-[1.25fr_1fr_1fr]"
          style={{ backgroundColor: "var(--desk-line)" }}
        >
          {/* Workers — widest column, plainest language. Someone deciding
              whether this is worth their evening reads this one. */}
          <div className="p-7 sm:p-8" style={{ backgroundColor: "var(--desk-raised)" }}>
            <p className="dojo-label mb-4" style={{ color: "var(--sol)" }}>
              If you want to earn
            </p>
            <p className="dojo-display text-[1.6rem]" style={{ color: "var(--slip)" }}>
              Answer a question,
              <br />
              get 0.001 SOL.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--paper-dim)" }}>
              Each task takes a few seconds — look at some images, pick the best one. Your
              balance goes up the moment you submit.
            </p>

            <div
              className="dojo-mono mt-6 space-y-2 rounded-[3px] border p-4 text-[12px]"
              style={{ borderColor: "var(--desk-line)", color: "var(--paper-dim)" }}
            >
              {[
                ["per answer", "0.001 SOL"],
                ["minimum withdrawal", "0.001 SOL"],
                ["wallet needed to", "withdraw only"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span>{label}</span>
                  <span style={{ color: "var(--slip)" }}>{value}</span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
              Sign up with an email and start now. Connect a wallet when you want the money.
            </p>
          </div>

          {/* Creators — outcome-oriented, shorter. */}
          <div className="p-7 sm:p-8" style={{ backgroundColor: "var(--desk-raised)" }}>
            <p className="dojo-label mb-4" style={{ color: "var(--paper-dim)" }}>
              If you need answers
            </p>
            <p className="dojo-display text-[1.35rem]" style={{ color: "var(--slip)" }}>
              A hundred opinions for 0.1 SOL.
            </p>
            <p className="mt-4 text-[14.5px] leading-relaxed" style={{ color: "var(--paper-dim)" }}>
              Upload the options, fund once, watch the votes land. Which logo, which
              thumbnail, which crop — the questions where you want a crowd, not a committee.
            </p>

            <ul className="mt-6 space-y-3">
              {CREATOR_POINTS.map((point) => (
                <li
                  key={point}
                  className="flex gap-2.5 text-[13.5px] leading-relaxed"
                  style={{ color: "var(--paper-dim)" }}
                >
                  <span className="dojo-mono shrink-0" style={{ color: "var(--settled)" }} aria-hidden>
                    ·
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Builders — densest, most technical, no marketing verbs. */}
          <div className="p-7 sm:p-8" style={{ backgroundColor: "var(--desk-raised)" }}>
            <p className="dojo-label mb-4" style={{ color: "var(--paper-dim)" }}>
              If you&apos;re evaluating it
            </p>
            <p className="dojo-display text-[1.35rem]" style={{ color: "var(--slip)" }}>
              Read the invariants.
            </p>
            <p className="mt-4 text-[14.5px] leading-relaxed" style={{ color: "var(--paper-dim)" }}>
              Express and Prisma on Postgres, Next.js on the front, Anchor for the escrow
              work. The interesting parts are the money paths.
            </p>

            <dl className="mt-6 space-y-3">
              {BUILDER_POINTS.map(([term, definition]) => (
                <div key={term}>
                  <dt className="dojo-label" style={{ color: "var(--ink-dim)" }}>
                    {term}
                  </dt>
                  <dd
                    className="dojo-mono mt-1 text-[11.5px] leading-relaxed"
                    style={{ color: "var(--paper-dim)" }}
                  >
                    {definition}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
};
