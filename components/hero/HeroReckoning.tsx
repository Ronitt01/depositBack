"use client";

/* ============================================================================
   DepositBack — "The Reckoning"
   An itemized ledger audits itself in front of you. Illegal charges are struck
   through one by one by an emerald authority-line; the legitimate charge holds
   with a quiet check. The struck amounts detach, fly together, and resolve into
   a glowing $720 that then doubles to $1,440 on California's real 2x statutory
   penalty. You watch the law do the math, live, on your own bill.

   Single self-contained file. DOM + framer-motion. Light theme only.
   Drives ALL animation from a single rAF-throttled scroll progress 0->1.

   POLISH PASS — elevations:
     • Easing: every transition rides an expressive cubic-bezier; spring counters
       resolve with a touch of momentum instead of snapping.
     • Choreography: rows stagger in, statute chips cascade, the sweep blooms,
       struck amounts detach and converge — transitions overlap, never cut.
     • Grade & light: layered warm-paper field + dual vignette, two-scale film
       grain (page + sheet), faked bloom on the emerald scanner and the gold
       halo (additive radial divs + drop-shadow), lift-off shadows for depth.
     • Type: editorial Fraunces with optical tracking, confident money scale,
       tabular-nums count-ups that RESOLVE rather than just appear.
     • Life: idle paper sway + float, a living gold core pulse and a slow drifting
       halo so the scene breathes at rest. Fully gated by prefers-reduced-motion.
   ========================================================================== */

import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const norm = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const ramp = (p: number, a: number, b: number) => {
  const t = norm(p, a, b);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* expressive curves — never linear, never default ease */
const EXPRESSIVE: [number, number, number, number] = [0.16, 1, 0.3, 1]; // out-expo, confident settle
const EXPRESSIVE_CSS = "cubic-bezier(0.16,1,0.3,1)";

type Row = { id: string; label: string; amount: number; illegal: boolean; statute?: string };

const DEPOSIT = 1800;
const ROWS: Row[] = [
  { id: "paint", label: "Repainting the entire apartment", amount: 350, illegal: true, statute: "Civ. Code §1950.5 — ordinary wear" },
  { id: "carpet", label: "Carpet cleaning", amount: 250, illegal: true, statute: "Civ. Code §1950.5 — routine cleaning" },
  { id: "nails", label: "Patching nail holes", amount: 120, illegal: true, statute: "Civ. Code §1950.5 — ordinary wear" },
  { id: "cabinet", label: "Replacing a cabinet door you broke", amount: 180, illegal: false },
];
const ILLEGAL_TOTAL = 720;
const PENALTY_TOTAL = 1440;

const STRIKE_ROWS = ROWS.filter((r) => r.illegal);
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function MoneyReadout({ mv }: { mv: MotionValue<number> }) {
  const [txt, setTxt] = useState(() => "$" + Math.round(mv.get()).toLocaleString("en-US"));
  useMotionValueEvent(mv, "change", (v) => {
    setTxt("$" + Math.round(v).toLocaleString("en-US"));
  });
  return <>{txt}</>;
}

export default function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);

  const progress = useMotionValue(0);
  const sp = useSpring(progress, { stiffness: 120, damping: 28, mass: 0.6 });

  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pState, setPState] = useState(0);
  const doubled = pState > 0.9;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration gate
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setReduced(mq.matches);
    onMq();
    mq.addEventListener?.("change", onMq);

    let raf = 0;
    let lastQuant = -1;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = r.height - vh;
      const p = clamp(total > 0 ? -r.top / total : 0);
      progress.set(p);
      const q = Math.round(p * 600);
      if (q !== lastQuant) {
        lastQuant = q;
        setPState(p);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      mq.removeEventListener?.("change", onMq);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [progress]);

  // ── continuous idle clock (life) ──
  const breath = useMotionValue(0);
  useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const start = performance.now();
    const loop = (t: number) => {
      breath.set((t - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mounted, breath]);

  const breathAmp = reduced ? 0.1 : 1;

  // ── sheet transform (perspective tilt + idle sway + recede on finale) ──
  const sheetRotXScroll = useTransform(sp, [0, 0.25, 0.72, 1], [0.4, 6.4, 6.0, 1.4]);
  const sheetScale = useTransform(sp, [0, 0.72, 0.86, 1], [1, 1, 0.985, 0.955]);
  const sheetOpacity = useTransform(sp, [0, 0.78, 0.92, 1], [1, 1, 0.7, 0.5]);
  const sheetBlurN = useTransform(sp, [0.8, 1], [0, 5]);
  const sheetBlur = useMotionValue("blur(0px)");
  useMotionValueEvent(sheetBlurN, "change", (b) => sheetBlur.set(`blur(${b}px)`));
  const sheetYScroll = useTransform(sp, [0, 0.25, 1], [0, -6, -30]);

  const swayX = useTransform(breath, (t) => Math.cos(t * 0.43) * 0.34 * breathAmp);
  const swayZ = useTransform(breath, (t) => Math.sin(t * 0.6) * 0.42 * breathAmp);
  const floatY = useTransform(breath, (t) => Math.sin(t * 0.5) * 4 * breathAmp);
  const rotX = useTransform([sheetRotXScroll, swayX], ([a, b]: number[]) => a + b);
  const sheetY = useTransform([sheetYScroll, floatY], ([a, b]: number[]) => a + b);

  // a faint key-light sheen that drifts across the sheet (alive at rest)
  const sheenX = useTransform(breath, (t) => 50 + Math.sin(t * 0.32) * 22 * breathAmp);
  const sheenPos = useMotionTemplate`${sheenX}% 0%`;

  // ── deposit figure: calm gold → muted, with a quiet strike once contested ──
  const depositColor = useTransform(sp, [0, 0.18, 0.3], ["rgb(176,125,22)", "rgb(176,125,22)", "rgb(108,122,113)"]);
  const depositStrike = useTransform(sp, [0.25, 0.34], [0, 1]);

  // ── parallax film grain ──
  const grainShift = useTransform(breath, (t) => `${Math.sin(t * 0.21) * 1.8}px ${Math.cos(t * 0.17) * 1.8}px`);
  const grainShift2 = useTransform(breath, (t) => `${Math.cos(t * 0.13) * 2.6}px ${Math.sin(t * 0.11) * 2.6}px`);

  // ── withheld counter: 0 → $900 → resolves DOWN to $720 of illegal charges ──
  const withheld = useSpring(0, { stiffness: 90, damping: 22, mass: 0.7 });
  useEffect(() => {
    const p = pState;
    let target = 0;
    if (p < 0.25) target = 0;
    else if (p < 0.5) target = lerp(0, 900, norm(p, 0.25, 0.45));
    else target = lerp(900, ILLEGAL_TOTAL, ramp(p, 0.5, 0.66));
    withheld.set(target);
  }, [pState, withheld]);
  const withheldColor = useTransform(sp, [0.25, 0.5, 0.66], ["rgb(207,58,44)", "rgb(207,58,44)", "rgb(176,125,22)"]);

  // ── resolve number: $0 → $720, then snaps to $1,440 (2x penalty) ──
  const resolve = useMotionValue(0);
  useEffect(() => {
    const p = pState;
    if (p < 0.74) resolve.set(0);
    else if (p < 0.88) resolve.set(lerp(0, ILLEGAL_TOTAL, ramp(p, 0.75, 0.86)));
    else resolve.set(lerp(ILLEGAL_TOTAL, PENALTY_TOTAL, ramp(p, 0.88, 0.96)));
  }, [pState, resolve]);

  // living pulse on the resolve number's halo (alive while it holds the hero)
  const haloPulse = useTransform(breath, (t) => 1 + Math.sin(t * 0.9) * 0.045 * breathAmp);
  const haloDrift = useTransform(breath, (t) => `${Math.sin(t * 0.27) * 8 * breathAmp}px ${Math.cos(t * 0.23) * 6 * breathAmp}px`);

  // ── beat copy windows (overlap so lines cross-fade, never cut) ──
  const beat0 = useTransform(sp, [0, 0.06, 0.18, 0.24], [0, 1, 1, 0]);
  const beat1 = useTransform(sp, [0.2, 0.27, 0.44, 0.5], [0, 1, 1, 0]);
  const beat2 = useTransform(sp, [0.46, 0.53, 0.68, 0.74], [0, 1, 1, 0]);
  const beat3 = useTransform(sp, [0.72, 0.8, 1], [0, 1, 1]);
  const finale = useTransform(sp, [0.88, 0.95, 1], [0, 1, 1]);
  const hintOpacity = useTransform(sp, [0, 0.05], [1, 0]);

  // ── the emerald authority-line: sweeps top → bottom through the ledger ──
  const sweepP = useTransform(sp, [0.5, 0.7], [0, 1]);
  const sweepTop = useTransform(sweepP, [0, 1], ["3%", "94%"]);
  const sweepOpacity = useTransform(sp, [0.49, 0.52, 0.69, 0.72], [0, 1, 1, 0]);
  // a soft bloom that trails the scanner, sized larger and additively blended
  const sweepGlowOpacity = useTransform(sp, [0.49, 0.53, 0.68, 0.72], [0, 0.55, 0.55, 0]);

  // ── finale layers ──
  const haloOpacity = useTransform(sp, [0.78, 0.9, 1], [0, 0.95, 0.85]);
  const haloScaleScroll = useTransform(sp, [0.78, 0.92], [0.7, 1]);
  const haloScale = useTransform([haloScaleScroll, haloPulse], ([a, b]: number[]) => a * b);
  const resolveCaption = useTransform(sp, [0.8, 0.88], [0, 1]);
  const finaleA = useTransform(sp, [0.9, 0.95], [0, 1]);
  const finaleB = useTransform(sp, [0.95, 1], [0, 1]);
  const finaleCurrency = useTransform(sp, [0.9, 0.96], [0, 1]);
  const finaleCta = useTransform(sp, [0.93, 0.99], [0, 1]);
  const rupeeMix = useTransform(sp, [0.95, 1], [0, 1]);
  // Hoisted out of JSX: these MUST be called every render (the `!mounted` early
  // return below would otherwise change the hook count and crash the component).
  const finaleAY = useTransform(finaleA, [0, 1], [22, 0]);
  const finaleBY = useTransform(finaleB, [0, 1], [16, 0]);
  const finaleCtaY = useTransform(finaleCta, [0, 1], [18, 0]);

  const strikeProgress = (rowIndex: number) => {
    const start = 0.52 + rowIndex * 0.05;
    return ramp(pState, start, start + 0.06);
  };
  const cabinetCheck = ramp(pState, 0.6, 0.69);

  if (!mounted) {
    return <section ref={sectionRef} className="relative h-[480vh] w-full bg-paper" aria-label="DepositBack" />;
  }

  return (
    <section ref={sectionRef} className="relative h-[480vh] w-full bg-paper" aria-label="DepositBack — watch the law do the math">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* ── graded paper field: warm radial base + soft dual vignette ── */}
        <div className="absolute inset-0 bg-paper" />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(125% 95% at 50% 36%, #f8f5ee 0%, #f3f0e7 40%, #ece7db 76%, #e4ddcd 100%)" }}
        />
        {/* primary soft vignette (ink, never pure black) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(112% 82% at 50% 44%, rgba(0,0,0,0) 50%, rgba(28,40,33,0.10) 84%, rgba(20,30,25,0.20) 100%)" }}
        />
        {/* warm light pool top-center for cinematic key */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-soft-light"
          style={{ background: "radial-gradient(60% 45% at 50% 22%, rgba(246,233,200,0.55) 0%, rgba(246,233,200,0) 70%)" }}
        />

        {/* ── parallax film grain (two scales, multiply) ── */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-10 z-[2] mix-blend-multiply"
          style={{
            backgroundPosition: grainShift,
            opacity: 0.05,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-10 z-[2] mix-blend-multiply"
          style={{
            backgroundPosition: grainShift2,
            opacity: 0.025,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.35' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n2)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* ── top bar ── */}
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-2.5">
            <motion.span
              className="inline-block h-3.5 w-3.5 rounded-[3px] bg-gradient-to-br from-gold-bright to-gold shadow-[0_2px_10px_rgba(176,125,22,0.4)]"
              style={{ rotate: 45 }}
              animate={reduced ? undefined : { rotate: [45, 51, 45] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-display text-lg tracking-[-0.01em] text-ink">DepositBack</span>
          </div>
          <a
            href="#tool"
            className="rounded-full border border-line bg-card/70 px-4 py-1.5 text-sm font-medium text-ink-soft shadow-soft backdrop-blur transition-colors hover:border-gold hover:text-gold"
            style={{ transitionTimingFunction: EXPRESSIVE_CSS }}
          >
            Open the tool →
          </a>
        </div>
        {/* progress rail */}
        <div className="absolute inset-x-0 top-0 z-30 h-[2px] bg-line/60">
          <motion.div className="h-full origin-left bg-gradient-to-r from-gold via-gold-bright to-emerald" style={{ scaleX: sp }} />
        </div>

        {/* ── THE LEDGER (perspective stage) ── */}
        <div className="absolute inset-0 z-10 flex items-center justify-center [perspective:1600px]">
          <motion.div
            className="relative"
            style={{ y: sheetY, opacity: sheetOpacity, filter: sheetBlur, rotateX: rotX, rotateZ: swayZ, scale: sheetScale, transformStyle: "preserve-3d" }}
          >
            {/* lift-off ground shadow */}
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -z-10 h-[78%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[28px]"
              style={{ boxShadow: "0 44px 96px -30px rgba(20,30,25,0.46)" }}
            />
            <div
              className="relative w-[min(92vw,560px)] overflow-hidden rounded-[18px] border border-line bg-[#fbf7ee]"
              style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.75) inset, 0 2px 6px rgba(21,35,28,0.05), 0 32px 74px -28px rgba(21,35,28,0.36)" }}
            >
              {/* paper texture on the sheet */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='pp'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23pp)'/%3E%3C/svg%3E\")" }}
              />
              {/* drifting key-light sheen across the sheet (idle life) */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                style={{
                  backgroundImage: "linear-gradient(105deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 62%)",
                  backgroundSize: "260% 100%",
                  backgroundPosition: sheenPos,
                }}
              />
              {/* hairline legal letterhead ruling at very top */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent" />

              {/* header */}
              <div className="relative px-7 pt-7 md:px-9">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted">Security Deposit · Statement</p>
                    <p className="mt-1 font-display text-xl tracking-[-0.01em] text-ink">Itemized Deductions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Deposit held</p>
                    <motion.p
                      className="tnum relative inline-block font-display text-2xl tracking-[-0.01em] md:text-3xl"
                      style={{ color: depositColor, textShadow: "0 1px 0 rgba(255,255,255,0.6)" }}
                    >
                      {fmt(DEPOSIT)}
                      <motion.span aria-hidden className="absolute left-0 top-1/2 h-[1.5px] w-full origin-left bg-muted" style={{ scaleX: depositStrike }} />
                    </motion.p>
                  </div>
                </div>
                <div className="mt-4 h-px w-full bg-line" />
              </div>

              {/* rows + scanner */}
              <div className="relative px-4 py-3 md:px-5">
                {/* faked bloom behind the scanner line (additive, soft, larger) */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-10 h-10 -translate-y-1/2 mix-blend-screen"
                  style={{
                    top: sweepTop,
                    opacity: sweepGlowOpacity,
                    background: "radial-gradient(60% 100% at 50% 50%, rgba(28,136,90,0.55) 0%, rgba(28,136,90,0) 72%)",
                    filter: "blur(2px)",
                  }}
                />
                {/* the emerald authority-line itself */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-3 z-20 h-[2px]"
                  style={{
                    top: sweepTop,
                    opacity: sweepOpacity,
                    background: "linear-gradient(90deg, rgba(28,136,90,0) 0%, #1c885a 18%, #0e5e3c 50%, #1c885a 82%, rgba(28,136,90,0) 100%)",
                    boxShadow: "0 0 16px 2px rgba(28,136,90,0.5)",
                  }}
                />
                {ROWS.map((row, i) => {
                  const isIllegal = row.illegal;
                  const illegalIndex = STRIKE_ROWS.findIndex((r) => r.id === row.id);
                  const enter = ramp(pState, 0.25 + i * 0.05, 0.34 + i * 0.05);
                  const strike = isIllegal ? strikeProgress(illegalIndex) : 0;
                  const check = isIllegal ? 0 : cabinetCheck;
                  const lifted = isIllegal ? strike : check;
                  const fly = isIllegal ? ramp(pState, 0.75, 0.85) : 0;
                  const desat = isIllegal ? strike : 0;
                  return (
                    <div
                      key={row.id}
                      className="relative mb-0.5 rounded-lg px-3 py-2.5 md:px-4"
                      style={{
                        opacity: enter,
                        transform: `translateX(${(1 - enter) * 44}px) translateY(${-lifted * 2}px)`,
                        boxShadow: lifted > 0.05 ? `0 ${2 + lifted * 8}px ${10 + lifted * 14}px -8px rgba(21,35,28,${0.18 * lifted})` : "none",
                        background: lifted > 0.05 ? `rgba(255,255,255,${0.5 + lifted * 0.45})` : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="relative min-w-0 flex-1">
                          <span
                            className="relative inline-block max-w-full truncate align-middle text-[13.5px] tracking-[-0.005em] md:text-[14.5px]"
                            style={{ color: `rgb(${lerp(21, 108, desat)}, ${lerp(35, 122, desat)}, ${lerp(28, 113, desat)})` }}
                          >
                            {row.label}
                            <span aria-hidden className="absolute left-0 top-1/2 h-[1.5px] w-full origin-left bg-danger" style={{ transform: `scaleX(${strike})` }} />
                          </span>
                          {isIllegal ? (
                            <span
                              className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium text-emerald-deep"
                              style={{ opacity: strike, transform: `translateX(${(1 - strike) * -8}px)` }}
                            >
                              <span className="inline-flex items-center rounded-full border border-emerald/30 bg-emerald-soft px-2 py-0.5 shadow-[0_1px_4px_rgba(14,94,60,0.12)]">{row.statute}</span>
                            </span>
                          ) : (
                            <span className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium text-emerald-deep" style={{ opacity: check }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
                                <path d="M20 6L9 17l-5-5" stroke="#0e5e3c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 - check }} />
                              </svg>
                              <span>Valid — actual damage you caused</span>
                            </span>
                          )}
                        </div>
                        <span
                          className="tnum shrink-0 text-[14px] font-semibold tracking-[-0.01em] md:text-[15px]"
                          style={{
                            color: isIllegal ? "#cf3a2c" : "#0e5e3c",
                            opacity: isIllegal ? 1 - fly : 1,
                            transform: isIllegal ? `translate(${fly * -30}px, ${fly * 90}px) scale(${1 - fly * 0.35})` : "none",
                            textShadow: isIllegal && fly > 0.1 ? `0 0 ${fly * 12}px rgba(176,125,22,${fly * 0.5})` : "none",
                          }}
                        >
                          {fmt(row.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* withheld total */}
              <div className="relative mt-1 border-t border-line px-7 py-4 md:px-9">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted">Withheld from you</span>
                  <motion.span className="tnum font-display text-xl tracking-[-0.01em] md:text-2xl" style={{ color: withheldColor }}>
                    <MoneyReadout mv={withheld} />
                  </motion.span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── THE RESOLVE: glowing money number is the hero ── */}
        <motion.div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center" style={{ opacity: beat3 }}>
          <div className="relative flex flex-col items-center">
            {/* gold halo (faked bloom) — drifts + pulses, never harsh */}
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-1/2 -z-10 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                opacity: haloOpacity,
                scale: haloScale,
                backgroundPosition: haloDrift,
                background: "radial-gradient(circle, rgba(227,173,60,0.44) 0%, rgba(246,233,200,0.30) 30%, rgba(244,241,233,0) 66%)",
              }}
            />
            {/* 2x penalty badge snaps in with overshoot */}
            <motion.div
              className="mb-3 flex items-center gap-2"
              animate={doubled ? { scale: [0.6, 1.14, 1], opacity: 1 } : { scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.5, ease: EXPRESSIVE }}
            >
              <span className="rounded-full border border-emerald/40 bg-emerald-soft px-3 py-1 text-xs font-semibold tracking-[0.01em] text-emerald-deep shadow-[0_2px_10px_rgba(14,94,60,0.18)]">
                ×2 statutory penalty · Civ. Code §1950.5(l)
              </span>
            </motion.div>
            {/* the number, gold-clipped with a slow sheen */}
            <div
              className="tnum font-display leading-none"
              style={{
                fontSize: "clamp(72px, 14vw, 168px)",
                letterSpacing: "-0.02em",
                backgroundImage: "linear-gradient(100deg, #e3ad3c 0%, #f6e9c8 28%, #b07d16 52%, #e3ad3c 76%, #f6e9c8 100%)",
                backgroundSize: "220% 100%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                animation: reduced ? "none" : "shimmer 5.5s ease-in-out infinite",
                filter: "drop-shadow(0 6px 20px rgba(176,125,22,0.30))",
              }}
            >
              <MoneyReadout mv={resolve} />
            </div>
            <motion.p className="mt-5 max-w-xs text-center text-sm font-medium text-ink-soft md:text-base" style={{ opacity: resolveCaption }}>
              What your landlord likely owes you back.
            </motion.p>
          </div>
        </motion.div>

        {/* ── staged serif beat copy ── */}
        <div className="pointer-events-none absolute inset-x-0 top-[16%] z-20 flex justify-center px-6">
          <BeatLine o={beat0} text="You moved out." />
          <BeatLine o={beat1} text="They kept your deposit." tint="danger" />
          <BeatLine o={beat2} text="The law is on your side." tint="emerald" />
        </div>

        {/* ── finale ── */}
        <motion.div className="absolute inset-0 z-30 flex flex-col items-center justify-end pb-[12vh]" style={{ opacity: finale }}>
          <div className="flex flex-col items-center text-center">
            <h2 className="font-display text-ink" style={{ fontSize: "clamp(34px, 6vw, 64px)", lineHeight: 1.04, letterSpacing: "-0.015em" }}>
              <motion.span className="inline-block" style={{ opacity: finaleA, y: finaleAY }}>
                Get back every dollar.
              </motion.span>{" "}
              <motion.span className="inline-block italic text-gold" style={{ opacity: finaleB, y: finaleBY }}>
                And every rupee.
              </motion.span>
            </h2>
            <motion.div aria-hidden className="relative mt-4 flex h-9 items-center justify-center" style={{ opacity: finaleCurrency }}>
              <MorphGlyph mix={rupeeMix} />
            </motion.div>
            <motion.a
              href="#tool"
              className="group pointer-events-auto relative mt-7 inline-flex items-center gap-2 overflow-hidden rounded-full bg-emerald-deep px-7 py-3.5 text-base font-semibold tracking-[0.005em] text-paper shadow-[0_14px_44px_rgba(14,94,60,0.4)]"
              style={{ opacity: finaleCta, y: finaleCtaY }}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
            >
              <span className="relative z-10">Check my deposit →</span>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-5 bottom-2 h-[2px]"
                style={{
                  background: "linear-gradient(90deg, transparent, #e3ad3c, transparent)",
                  backgroundSize: "200% 100%",
                  animation: reduced ? "none" : "shimmer 3s ease-in-out infinite",
                }}
              />
            </motion.a>
          </div>
        </motion.div>

        {/* ── scroll hint ── */}
        <motion.div className="pointer-events-none absolute inset-x-0 bottom-7 z-20 flex flex-col items-center gap-2" style={{ opacity: hintOpacity }}>
          <span className="text-[11px] uppercase tracking-[0.25em] text-muted">Scroll</span>
          <motion.span className="text-muted" animate={reduced ? undefined : { y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
            ↓
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}

function BeatLine({ o, text, tint }: { o: MotionValue<number>; text: string; tint?: "danger" | "emerald" }) {
  const color = tint === "danger" ? "text-danger" : tint === "emerald" ? "text-emerald-deep" : "text-ink";
  const y = useTransform(o, [0, 1], [40, 0]);
  const scale = useTransform(o, [0, 1], [0.985, 1]);
  return (
    <motion.h1
      className={`absolute font-display ${color} text-center`}
      style={{
        opacity: o,
        y,
        scale,
        fontSize: "clamp(30px, 5.2vw, 58px)",
        lineHeight: 1.04,
        letterSpacing: "-0.015em",
        textShadow: "0 1px 18px rgba(244,241,233,0.9), 0 2px 4px rgba(244,241,233,0.9)",
      }}
    >
      {text}
    </motion.h1>
  );
}

function MorphGlyph({ mix }: { mix: MotionValue<number> }) {
  const dollarOpacity = useTransform(mix, [0, 1], [1, 0]);
  const rupeeOpacity = useTransform(mix, [0, 1], [0, 1]);
  const dollarScale = useTransform(mix, [0, 1], [1, 0.7]);
  const rupeeScale = useTransform(mix, [0, 1], [0.7, 1]);
  return (
    <div className="relative flex h-9 w-9 items-center justify-center">
      <div className="absolute h-9 w-9 rounded-full" style={{ background: "radial-gradient(circle, rgba(227,173,60,0.5) 0%, rgba(246,233,200,0) 70%)" }} />
      <motion.span className="absolute font-display text-2xl font-semibold text-gold" style={{ opacity: dollarOpacity, scale: dollarScale }}>
        $
      </motion.span>
      <motion.span className="absolute font-display text-2xl font-semibold text-gold" style={{ opacity: rupeeOpacity, scale: rupeeScale }}>
        ₹
      </motion.span>
    </div>
  );
}
