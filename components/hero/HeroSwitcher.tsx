"use client";

/* Head-to-head toggle for the two competition-winning heroes.
   Flip between them live; your pick is remembered in localStorage.
   Both are loaded client-only (ssr:false) — only the selected one mounts. */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroMolten = dynamic(() => import("./HeroMolten"), { ssr: false });
const HeroReckoning = dynamic(() => import("./HeroReckoning"), { ssr: false });

type Variant = "molten" | "reckoning";

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
      {variant === "molten" ? <HeroMolten /> : <HeroReckoning />}

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
