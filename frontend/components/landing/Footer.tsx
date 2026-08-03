"use client";

/**
 * Footer.
 *
 * Every link here resolves: on-page anchors, the real GitHub repository, and a
 * mailto. The previous version had four `href="#"` placeholders pointing at
 * Documentation, Twitter, Discord and Contact, none of which exist — a dead
 * link in the footer of a money product costs more trust than an absent one.
 */

const REPO = "https://github.com/kingsleycj/dojopay";

export const Footer = () => {
  return (
    <footer className="border-t" style={{ borderColor: "var(--desk-line)" }}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="dojo-display text-[1.15rem]" style={{ color: "var(--slip)" }}>
              DojoPay
            </p>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
              Micro-tasks paid in SOL. Currently on devnet.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[13.5px]">
            {[
              ["How it works", "#how"],
              ["Guarantees", "#guarantees"],
              ["Roadmap", "#roadmap"],
            ].map(([label, href]) => (
              <a key={href} href={href} style={{ color: "var(--paper-dim)" }}>
                {label}
              </a>
            ))}

            <a
              href={REPO}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--paper-dim)" }}
            >
              Source
            </a>
            <a href="mailto:support@dojopay.io" style={{ color: "var(--paper-dim)" }}>
              Contact
            </a>
          </nav>
        </div>

        <div
          className="dojo-mono mt-10 flex flex-col gap-2 border-t pt-6 text-[11px] sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--desk-line)", color: "var(--ink-dim)" }}
        >
          <span>Solana devnet · funds held by the platform wallet, not a contract</span>
          <span>© {new Date().getFullYear()} DojoPay</span>
        </div>
      </div>
    </footer>
  );
};
