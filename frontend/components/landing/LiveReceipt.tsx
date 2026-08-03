"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

/**
 * The page's signature element: one task's ledger, settling.
 *
 * Why this and not a hero graphic — DojoPay's economics are a closed sum. A
 * creator commits a budget across a chosen number of slots, and the reward per
 * slot is the budget divided by that count, so a correct ledger always
 * reconciles to zero remaining. That arithmetic is the product's actual claim to
 * trustworthiness right now (the submission cap is enforced race-safely, per
 * CLAUDE.md Phase 3), and it is more persuasive demonstrated than asserted.
 *
 * The figures below are **one example** — 0.5 SOL over 50 answers — not fixed
 * platform pricing, which creators now set per task. What is not illustrative is
 * the relationship between them: the reward is derived here exactly as
 * `planBudget` derives it on the server, so the demo cannot show a split the
 * backend would not actually produce.
 */

const LAMPORTS_PER_SOL = 1_000_000_000;
const TASK_PRICE_LAMPORTS = 500_000_000; // 0.5 SOL — one creator's choice, not a fixed price
const MAX_SUBMISSIONS = 50;
const REWARD_LAMPORTS = Math.floor(TASK_PRICE_LAMPORTS / MAX_SUBMISSIONS); // 0.01 SOL

/** Rows visible in the printed window at once. */
const WINDOW = 6;

/** Illustrative wallet stubs. Deliberately not real addresses. */
const WALLET_STUBS = [
  "7xKQ…4mPz", "9dFa…Wq2L", "3nRv…8cTb", "Hs4Y…pL9k",
  "2Bmq…rZ7t", "Ct8W…3fVn", "5PxE…kM6a", "Jq1D…9wSr",
  "8vNh…Tz4c", "Ry6K…2bXm", "4Gtu…nQ8p", "Ws9L…5dHf",
];

function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(3);
}

interface Row {
  slot: number;
  wallet: string;
  ms: number;
}

type State = { filled: number; rows: Row[]; settled: boolean };

type Action = { type: "fill"; row: Row } | { type: "settle" } | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "fill":
      return {
        ...state,
        filled: action.row.slot,
        rows: [...state.rows, action.row].slice(-WINDOW),
      };
    case "settle":
      return { ...state, settled: true };
    case "reset":
      return { filled: 0, rows: [], settled: false };
  }
}

/** The finished state, used for reduced motion and as the SSR output. */
function completedState(): State {
  return {
    filled: MAX_SUBMISSIONS,
    rows: Array.from({ length: WINDOW }, (_, index) => ({
      slot: MAX_SUBMISSIONS - WINDOW + index + 1,
      wallet: WALLET_STUBS[index % WALLET_STUBS.length],
      ms: 180 + index * 17,
    })),
    settled: true,
  };
}

export function LiveReceipt() {
  const [state, dispatch] = useReducer(reducer, completedState());
  const [animate, setAnimate] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /**
   * Only animate once mounted and only if the visitor has not asked for less
   * motion. Server-rendering the completed state means the reconciliation is
   * legible before any JavaScript runs, and there is no layout shift when it
   * does.
   */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    setAnimate(true);
    dispatch({ type: "reset" });

    const schedule = (fn: () => void, delay: number) => {
      timers.current.push(setTimeout(fn, delay));
    };

    let elapsed = 600;
    for (let slot = 1; slot <= MAX_SUBMISSIONS; slot++) {
      // Ease the cadence: brisk through the middle, slowing as the last slots
      // go, so the eye lands on the moment the task closes.
      const remaining = MAX_SUBMISSIONS - slot;
      const gap = remaining < 4 ? 420 : remaining < 12 ? 150 : 42;
      elapsed += gap;

      schedule(() => {
        dispatch({
          type: "fill",
          row: {
            slot,
            wallet: WALLET_STUBS[slot % WALLET_STUBS.length],
            ms: 120 + ((slot * 37) % 260),
          },
        });
      }, elapsed);
    }

    schedule(() => dispatch({ type: "settle" }), elapsed + 500);

    const captured = timers.current;
    return () => captured.forEach(clearTimeout);
  }, []);

  const creditedLamports = state.filled * REWARD_LAMPORTS;
  const remainingLamports = TASK_PRICE_LAMPORTS - creditedLamports;
  const percent = (state.filled / MAX_SUBMISSIONS) * 100;

  const reconciles = useMemo(
    () => creditedLamports + remainingLamports === TASK_PRICE_LAMPORTS,
    [creditedLamports, remainingLamports],
  );

  return (
    <figure className="relative mx-auto w-full max-w-[26rem]">
      <figcaption className="sr-only">
        A live illustration of one DojoPay task settling: an example budget of 0.5 SOL
        split across 50 answers at 0.01 SOL each, reconciling to nothing remaining.
      </figcaption>

      {/* Receipt */}
      <div className="dojo-slip dojo-torn relative rounded-t-[3px] pb-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        {/* Header */}
        <div className="border-b border-dashed px-5 pt-5 pb-3" style={{ borderColor: "var(--slip-line)" }}>
          <div className="flex items-baseline justify-between">
            <span className="dojo-label" style={{ color: "var(--ink-dim)" }}>
              Task ledger
            </span>
            <span className="dojo-mono text-[11px]" style={{ color: "var(--ink-dim)" }}>
              devnet
            </span>
          </div>
          <p className="dojo-display mt-2 text-[1.35rem]" style={{ color: "var(--ink)" }}>
            Pick the sharpest logo
          </p>
          <div className="dojo-mono mt-1 flex items-baseline gap-2 text-[11px]" style={{ color: "var(--ink-dim)" }}>
            <span>funded</span>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {formatSol(TASK_PRICE_LAMPORTS)} SOL
            </span>
            <span aria-hidden>·</span>
            <span>{MAX_SUBMISSIONS} slots</span>
          </div>
        </div>

        {/* Printed rows */}
        <div className="px-5 py-3">
          <div
            className="dojo-mono mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.14em]"
            style={{ color: "var(--ink-dim)" }}
          >
            <span>slot · worker</span>
            <span>credited</span>
          </div>

          <ul
            className="dojo-mono space-y-[3px] text-[12px]"
            style={{ minHeight: `${WINDOW * 22}px` }}
            aria-live="off"
          >
            {state.rows.map((row) => (
              <li
                key={row.slot}
                className={`flex items-center justify-between tabular-nums ${animate ? "dojo-print" : ""}`}
                style={{ color: "var(--ink)" }}
              >
                <span className="flex items-center gap-2">
                  <span style={{ color: "var(--ink-dim)" }}>
                    {String(row.slot).padStart(3, "0")}
                  </span>
                  <span>{row.wallet}</span>
                  <span className="text-[10px]" style={{ color: "var(--settled)" }}>
                    ✓{row.ms}ms
                  </span>
                </span>
                <span className="font-medium">+{formatSol(REWARD_LAMPORTS)}</span>
              </li>
            ))}

            {/* The print head, while slots remain. */}
            {animate && !state.settled && (
              <li className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-dim)" }}>
                <span className="dojo-blink" aria-hidden>
                  ▌
                </span>
                <span className="text-[11px]">awaiting submission…</span>
              </li>
            )}
          </ul>
        </div>

        {/* Reconciliation */}
        <div
          className="mx-5 border-t border-dashed pt-3"
          style={{ borderColor: "var(--slip-line)" }}
        >
          <div
            className="h-[3px] w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--slip-line)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={MAX_SUBMISSIONS}
            aria-valuenow={state.filled}
            aria-label="Submission slots filled"
          >
            <div
              className="h-full rounded-full transition-[width] duration-150 ease-out"
              style={{ width: `${percent}%`, backgroundColor: "var(--sol)" }}
            />
          </div>

          <dl className="dojo-mono mt-3 space-y-1 text-[12px]" style={{ color: "var(--ink)" }}>
            <div className="flex justify-between">
              <dt style={{ color: "var(--ink-dim)" }}>
                paid to workers ({state.filled}/{MAX_SUBMISSIONS})
              </dt>
              <dd className="tabular-nums">{formatSol(creditedLamports)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--ink-dim)" }}>unspent</dt>
              <dd className="tabular-nums">{formatSol(remainingLamports)}</dd>
            </div>
            <div
              className="flex justify-between border-t pt-1 font-semibold"
              style={{ borderColor: "var(--slip-line)" }}
            >
              <dt>total</dt>
              <dd className="tabular-nums">{formatSol(TASK_PRICE_LAMPORTS)} SOL</dd>
            </div>
          </dl>

          {/* The whole point, stated once, in the smallest type on the page. */}
          <p className="dojo-mono mt-3 text-[10.5px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
            {reconciles ? "balanced" : "unbalanced"} — a task can never pay out more than it
            was funded for. The slot cap is enforced on write, so two workers
            cannot claim the same slot.
          </p>
        </div>

        {/* Settled stamp.
            Sits in the header's right margin, alongside the short "funded"
            line — the one part of the receipt with reliable clear space. Over
            the line items it obscured the numbers, and over the totals it
            obscured the reconciliation, which is the whole point of the piece. */}
        {state.settled && (
          <div
            className={`pointer-events-none absolute right-3 top-[4.15rem] select-none ${animate ? "dojo-stamp" : ""}`}
            style={{ transform: "rotate(-14deg)" }}
            aria-hidden
          >
            <span
              className="dojo-label block rounded-[2px] border-2 px-2 py-1 text-[10px] font-bold"
              style={{ color: "var(--settled)", borderColor: "var(--settled)", opacity: 0.9 }}
            >
              Fully subscribed
            </span>
          </div>
        )}
      </div>
    </figure>
  );
}
