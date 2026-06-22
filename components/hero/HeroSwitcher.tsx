"use client";

/* Head-to-head toggle for the two competition-winning heroes.
   Flip between them live; your pick is remembered in localStorage.
   Both are loaded client-only (ssr:false) — only the selected one mounts. */

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";

const HeroMolten = dynamic(() => import("./HeroMolten"), { ssr: false });
const HeroReckoning = dynamic(() => import("./HeroReckoning"), { ssr: false });

type Variant = "molten" | "reckoning";

/* Isolates a hero crash so it can never take the whole page down — the toggle
   stays usable and a calm fallback shows instead of a blank/error screen.
   Resets automatically when you switch variants (keyed by `variant`). */
class HeroErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("Hero variant failed to render:", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <section className="flex h-screen w-full flex-col items-center justify-center bg-paper px-6 text-center">
          <span className="mb-4 inline-block h-4 w-4 rotate-45 rounded-[3px] bg-gradient-to-br from-gold-bright to-gold" />
          <h1 className="font-display text-3xl text-ink sm:text-4xl">Get back every dollar.</h1>
          <p className="mt-2 text-sm text-muted">This hero hit a snag — try the other one below, or scroll to the tool.</p>
        </section>
      );
    }
    return this.props.children;
  }
}

const OPTIONS: { id: Variant; label: string }[] = [
  { id: "molten", label: "Molten Verdict" },
  { id: "reckoning", label: "The Ledger" },
];

export default function HeroSwitcher() {
  const [variant, setVariant] = useState<Variant>("molten");

  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get("hero");
    const saved = (url || localStorage.getItem("db_hero")) as Variant | null;
    if (saved === "molten" || saved === "reckoning") setVariant(saved);
  }, []);

  const pick = (v: Variant) => {
    setVariant(v);
    try {
      localStorage.setItem("db_hero", v);
    } catch {}
  };

  return (
    <div className="relative">
      <HeroErrorBoundary key={variant}>
        {variant === "molten" ? <HeroMolten /> : <HeroReckoning />}
      </HeroErrorBoundary>

      {/* floating A/B toggle */}
      <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-1 rounded-full border border-line bg-white/85 p-1 shadow-[0_2px_6px_rgba(21,35,28,0.06),0_20px_50px_rgba(21,35,28,0.12)] backdrop-blur">
        <span className="select-none pl-2.5 pr-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
          Hero
        </span>
        {OPTIONS.map((o) => {
          const active = o.id === variant;
          return (
            <button
              key={o.id}
              onClick={() => pick(o.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-emerald-deep text-white shadow-[0_2px_10px_rgba(14,94,60,0.3)]"
                  : "text-ink-soft hover:text-ink"
              }`}
              style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
