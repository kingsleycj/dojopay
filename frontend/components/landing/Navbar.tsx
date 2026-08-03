"use client";

import { useEffect, useState } from "react";

type NavbarProps = {
  onGetStarted?: () => void;
  onSignIn?: () => void;
};

const LINKS: Array<[label: string, href: string]> = [
  ["How it works", "#how"],
  ["Guarantees", "#guarantees"],
  ["Who it's for", "#audience"],
  ["Roadmap", "#roadmap"],
];

/**
 * Navbar.
 *
 * Anchors point only at sections that actually exist on this page — no
 * placeholder `#` hrefs. Goes opaque on scroll so the ledger ruling behind it
 * does not fight the labels.
 */
export const Navbar = ({ onGetStarted, onSignIn }: NavbarProps) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b transition-colors duration-200"
      style={{
        backgroundColor: scrolled ? "rgba(28,26,23,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(8px)" : undefined,
        WebkitBackdropFilter: scrolled ? "blur(8px)" : undefined,
        borderColor: scrolled ? "var(--desk-line)" : "transparent",
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <a href="#top" className="flex items-baseline gap-2">
          <span className="dojo-display text-[1.15rem]" style={{ color: "var(--slip)" }}>
            DojoPay
          </span>
          <span className="dojo-mono text-[10px]" style={{ color: "var(--paper-dim)" }}>
            devnet
          </span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-[13.5px] transition-colors duration-150 hover:opacity-100"
              style={{ color: "var(--paper-dim)" }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSignIn}
            className="hidden rounded-[3px] px-3 py-2 text-[13.5px] sm:inline-flex"
            style={{ color: "var(--paper-dim)" }}
          >
            Sign in
          </button>
          <button
            onClick={onGetStarted}
            className="rounded-[3px] px-4 py-2 text-[13.5px] font-semibold transition-transform duration-150 hover:-translate-y-px"
            style={{ backgroundColor: "var(--sol)", color: "var(--ink)" }}
          >
            Get started
          </button>
        </div>
      </nav>
    </header>
  );
};
