"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JURISDICTIONS, getJurisdiction } from "@/lib/jurisdictions";
import { buildVerdict, formatMoney } from "@/lib/engine";
import { generateDemandLetter, type LetterParty } from "@/lib/letter";
import { EXAMPLES, type Example } from "@/lib/examples";
import type {
  CaseInput,
  ClassifiedDeduction,
  DeductionVerdict,
  LeaseClauseFlag,
} from "@/lib/types";

/* ── date helpers (client) ─────────────────────────────────────────────── */
const todayISO = () => new Date().toISOString().slice(0, 10);
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ── small count-up for the headline figure ────────────────────────────── */
function useCountUp(target: number, run: boolean, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

type Row = { text: string; amount: string };

const TONE = {
  strong: { ring: "ring-emerald/30", bg: "bg-emerald-soft", text: "text-emerald-deep", dot: "bg-emerald" },
  mixed: { ring: "ring-amber/30", bg: "bg-amber-soft", text: "text-amber", dot: "bg-amber" },
  weak: { ring: "ring-line", bg: "bg-paper-2", text: "text-ink-soft", dot: "bg-muted" },
  info: { ring: "ring-sky/40", bg: "bg-emerald-soft", text: "text-emerald-deep", dot: "bg-sky" },
} as const;

const VERDICT_CHIP: Record<DeductionVerdict, string> = {
  illegal: "bg-danger-soft text-danger",
  legitimate: "bg-emerald-soft text-emerald-deep",
  ambiguous: "bg-amber-soft text-amber",
};
const VERDICT_LABEL: Record<DeductionVerdict, string> = {
  illegal: "Likely illegal",
  legitimate: "Probably valid",
  ambiguous: "Needs proof",
};

export default function Tool() {
  const [code, setCode] = useState("US-CA");
  const [deposit, setDeposit] = useState("");
  const [rent, setRent] = useState("");
  const [moveOut, setMoveOut] = useState("");
  const [notReturned, setNotReturned] = useState(false);
  const [returned, setReturned] = useState("");
  const [rows, setRows] = useState<Row[]>([{ text: "", amount: "" }]);
  const [lease, setLease] = useState("");
  const [party, setParty] = useState<Partial<LetterParty>>({});

  const [busy, setBusy] = useState<null | "analyze" | "ocr">(null);
  const [error, setError] = useState<string | null>(null);
  const [ocrNote, setOcrNote] = useState(false);

  const [analysis, setAnalysis] = useState<{
    deductions: ClassifiedDeduction[];
    leaseFlags: LeaseClauseFlag[];
    input: CaseInput;
  } | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const jur = getJurisdiction(code)!;

  /* ── load an offline example (no API) ──────────────────────────────── */
  function loadExample(ex: Example) {
    setError(null);
    setOcrNote(false);
    setCode(ex.jurisdictionCode);
    setDeposit(String(ex.depositAmount));
    setRent(ex.monthlyRent ? String(ex.monthlyRent) : "");
    const mo = isoDaysAgo(ex.movedOutDaysAgo);
    setMoveOut(mo);
    if (ex.returnedDaysAgo === null) {
      setNotReturned(true);
      setReturned("");
    } else {
      setNotReturned(false);
      setReturned(isoDaysAgo(ex.returnedDaysAgo));
    }
    setRows(ex.deductions.map((d) => ({ text: d.text, amount: String(d.amount) })));
    setLease(ex.leaseFlags[0]?.clause ?? "");
    setParty(ex.party);

    const input: CaseInput = {
      jurisdictionCode: ex.jurisdictionCode,
      depositAmount: ex.depositAmount,
      monthlyRent: ex.monthlyRent,
      moveOutDate: mo,
      returnedDate: ex.returnedDaysAgo === null ? null : isoDaysAgo(ex.returnedDaysAgo),
      asOfDate: todayISO(),
      deductions: ex.deductions,
    };
    setAnalysis({ deductions: ex.deductions, leaseFlags: ex.leaseFlags, input });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /* ── run the real analysis (calls Gemini for classification) ───────── */
  async function analyze() {
    setError(null);
    setOcrNote(false);
    const depositNum = parseFloat(deposit);
    if (!depositNum || depositNum <= 0) return setError("Enter your deposit amount.");
    if (!moveOut) return setError("Enter your move-out date.");
    const cleanRows = rows.filter((r) => r.text.trim() && parseFloat(r.amount) > 0);

    setBusy("analyze");
    try {
      let deductions: ClassifiedDeduction[] = [];
      let leaseFlags: LeaseClauseFlag[] = [];
      if (cleanRows.length > 0 || lease.trim()) {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jurisdictionCode: code,
            deductions: cleanRows.map((r) => ({ text: r.text.trim(), amount: parseFloat(r.amount) })),
            leaseClause: lease.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Analysis failed.");
        deductions = data.deductions;
        leaseFlags = data.leaseFlags ?? [];
      }
      const input: CaseInput = {
        jurisdictionCode: code,
        depositAmount: depositNum,
        monthlyRent: rent ? parseFloat(rent) : undefined,
        moveOutDate: moveOut,
        returnedDate: notReturned ? null : returned || null,
        asOfDate: todayISO(),
        deductions,
      };
      setAnalysis({ deductions, leaseFlags, input });
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  /* ── photo OCR ─────────────────────────────────────────────────────── */
  async function onFile(file: File) {
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) {
      return setError("Upload a PNG, JPEG, WebP, or PDF.");
    }
    setBusy("ocr");
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read the file.");
      if (data.depositAmount) setDeposit(String(data.depositAmount));
      if (data.moveOutDate) setMoveOut(data.moveOutDate);
      if (data.returnedDate) {
        setReturned(data.returnedDate);
        setNotReturned(false);
      }
      if (Array.isArray(data.deductions) && data.deductions.length) {
        setRows(data.deductions.map((d: { text: string; amount: number }) => ({ text: d.text, amount: String(d.amount) })));
      }
      setOcrNote(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="tool" className="relative z-10 mx-auto w-full max-w-3xl px-5 py-20 sm:py-28">
      <header className="mb-10 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-gold">The tool</p>
        <h2 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
          Get your deposit back.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-soft">
          Tell us where you rented and what your landlord kept. We check it against the real statute, compute
          what you&apos;re owed, and write the demand letter.
        </p>
      </header>

      {/* Try an example */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <span className="text-sm text-muted">Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            onClick={() => loadExample(ex)}
            className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink shadow-[var(--shadow-soft)] transition hover:border-gold hover:text-gold"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="card p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Where did you rent?" className="sm:col-span-2">
            <select
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j.code} value={j.code}>
                  {j.short}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`Security deposit (${jur.currency})`}>
            <input
              inputMode="decimal"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="1800"
              className="input"
            />
          </Field>

          <Field
            label={`Monthly rent (${jur.currency})`}
            hint={jur.depositCap ? `Used to check the ${jur.depositCap.months}-month cap` : "Optional"}
          >
            <input
              inputMode="decimal"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              placeholder="optional"
              className="input"
            />
          </Field>

          <Field label="Move-out date">
            <input type="date" value={moveOut} onChange={(e) => setMoveOut(e.target.value)} className="input" />
          </Field>

          <Field label="Date deposit was returned">
            <input
              type="date"
              value={returned}
              disabled={notReturned}
              onChange={(e) => setReturned(e.target.value)}
              className="input disabled:opacity-40"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={notReturned}
                onChange={(e) => setNotReturned(e.target.checked)}
                className="accent-[var(--color-emerald)]"
              />
              Never returned / still waiting
            </label>
          </Field>
        </div>

        {/* Deductions */}
        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-ink">The landlord&apos;s deductions</label>
            <UploadButton busy={busy === "ocr"} onFile={onFile} />
          </div>
          {ocrNote && (
            <p className="mb-3 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
              Read from your photo — please check every line and amount below before continuing.
            </p>
          )}
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={r.text}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  placeholder="e.g. Repainting the apartment"
                  className="input flex-1"
                />
                <input
                  inputMode="decimal"
                  value={r.amount}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  placeholder="amount"
                  className="input w-28"
                />
                <button
                  onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ text: "", amount: "" }])}
                  className="rounded-lg px-2 text-muted transition hover:text-danger"
                  aria-label="Remove line"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setRows([...rows, { text: "", amount: "" }])}
            className="mt-2 text-sm font-medium text-emerald-deep transition hover:text-emerald"
          >
            + Add a deduction
          </button>
        </div>

        {/* Lease clause */}
        <Field label="Paste a lease clause to check (optional)" className="mt-6">
          <textarea
            value={lease}
            onChange={(e) => setLease(e.target.value)}
            rows={2}
            placeholder='e.g. "A $250 cleaning fee will be deducted from every deposit."'
            className="input resize-y"
          />
        </Field>

        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <button
          onClick={analyze}
          disabled={busy === "analyze"}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-deep px-6 py-3.5 font-medium text-white shadow-[var(--shadow-lift)] transition hover:bg-emerald disabled:opacity-60"
        >
          {busy === "analyze" ? "Checking the law…" : "Check my deposit →"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          No login. Nothing is stored. Informational only — not legal advice.
        </p>
      </div>

      {/* Results */}
      <div ref={resultRef}>
        {analysis && <Result key={analysis.input.moveOutDate + analysis.deductions.length} {...analysis} party={party} setParty={setParty} />}
      </div>
    </section>
  );
}

/* ───────────────────────────── Result ─────────────────────────────────── */

function Result({
  deductions,
  leaseFlags,
  input,
  party,
  setParty,
}: {
  deductions: ClassifiedDeduction[];
  leaseFlags: LeaseClauseFlag[];
  input: CaseInput;
  party: Partial<LetterParty>;
  setParty: (p: Partial<LetterParty>) => void;
}) {
  const verdict = useMemo(() => buildVerdict(getJurisdiction(input.jurisdictionCode)!, { ...input, deductions }), [input, deductions]);
  const j = verdict.jurisdiction;
  const tone = TONE[verdict.tone];
  const cur = j.currency;
  const owed = useCountUp(verdict.recovery.baseOwed, true);

  const letter = useMemo(
    () => generateDemandLetter({ ...input, deductions }, verdict, party, leaseFlags),
    [input, deductions, verdict, party, leaseFlags],
  );

  function copyLetter() {
    navigator.clipboard?.writeText(letter);
  }
  function printLetter() {
    window.print();
  }

  return (
    <div className="rise mt-10 space-y-6">
      {/* Verdict banner */}
      <div className={`card p-7 ring-1 ${tone.ring}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
          <span className={`text-xs font-medium uppercase tracking-[0.18em] ${tone.text}`}>
            {j.name} · {j.statuteCitation}
          </span>
        </div>
        <h3 className="mt-3 font-display text-3xl leading-tight text-ink text-balance sm:text-4xl">
          {verdict.headline}
        </h3>

        {verdict.recovery.baseOwed > 0 && (
          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">You&apos;re likely owed back</div>
              <div className="tnum font-display text-5xl text-emerald-deep">{formatMoney(owed, cur)}</div>
            </div>
            {verdict.recovery.penalty.applies && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">
                  Potential exposure {verdict.recovery.penalty.condition === "automatic" ? "in court" : "if bad-faith is found"}
                </div>
                <div className="tnum font-display text-3xl text-gold">up to {formatMoney(verdict.recovery.totalHigh, cur)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deadline finding */}
      <div className="card p-6">
        <SectionTitle>The deadline</SectionTitle>
        <p className="mt-1 font-display text-xl text-ink">{verdict.deadline.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{verdict.deadline.detail}</p>
      </div>

      {/* Deductions */}
      {deductions.length > 0 && (
        <div className="card p-6">
          <SectionTitle>Line-by-line</SectionTitle>
          <ul className="mt-3 divide-y divide-line">
            {deductions.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_CHIP[d.verdict]}`}>
                      {VERDICT_LABEL[d.verdict]}
                    </span>
                    <span className="font-medium text-ink">{d.text}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{d.reason}</p>
                </div>
                <span className="tnum shrink-0 font-medium text-ink">{formatMoney(d.amount, cur)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Penalty estimator */}
      {verdict.recovery.penalty.applies && (
        <div className="card p-6">
          <SectionTitle>Penalty exposure</SectionTitle>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {verdict.recovery.penalty.condition === "automatic" ? (
              <>
                {j.name} applies up to <b>{verdict.recovery.penalty.multiplier}×</b> the wrongfully-withheld amount
                {verdict.recovery.penalty.flat ? <> plus {formatMoney(verdict.recovery.penalty.flat, cur)}</> : null} on a
                violation.
              </>
            ) : (
              <>
                If a court finds the withholding was in bad faith, {j.name} allows up to{" "}
                <b>{verdict.recovery.penalty.multiplier}×</b> damages
                {verdict.recovery.penalty.flat ? <> plus {formatMoney(verdict.recovery.penalty.flat, cur)}</> : null}. This is{" "}
                <b>not automatic</b> — it&apos;s the ceiling, not a promise.
              </>
            )}{" "}
            {verdict.recovery.penalty.note}
          </p>
        </div>
      )}

      {/* Deposit cap */}
      {verdict.recovery.depositCapFlag && (
        <div className="card border-amber/40 p-6">
          <SectionTitle>Over the legal cap</SectionTitle>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Your deposit exceeds the {verdict.recovery.depositCapFlag.capMonths}-month cap
            ({formatMoney(verdict.recovery.depositCapFlag.capAmount, cur)}) by{" "}
            <b className="text-amber">{formatMoney(verdict.recovery.depositCapFlag.overBy, cur)}</b>.{" "}
            {verdict.recovery.depositCapFlag.note}
          </p>
        </div>
      )}

      {/* Lease flags */}
      {leaseFlags.length > 0 && (
        <div className="card p-6">
          <SectionTitle>Lease clauses</SectionTitle>
          <ul className="mt-3 space-y-3">
            {leaseFlags.map((f, i) => (
              <li key={i} className="text-sm">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.isLikelyVoid ? "bg-danger-soft text-danger" : "bg-emerald-soft text-emerald-deep"}`}>
                  {f.isLikelyVoid ? "Likely void" : "Looks ok"}
                </span>
                <span className="italic text-ink">“{f.clause}”</span>
                <p className="mt-1 text-ink-soft">{f.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Demand letter */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-6 no-print">
          <SectionTitle>Your demand letter</SectionTitle>
          <div className="flex gap-2">
            <button onClick={copyLetter} className="rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-gold hover:text-gold">
              Copy
            </button>
            <button onClick={printLetter} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-deep">
              Print / PDF
            </button>
          </div>
        </div>
        <div className="grid gap-2 border-b border-line p-6 sm:grid-cols-2 no-print">
          <PartyInput label="Your name" v={party.tenantName} onChange={(x) => setParty({ ...party, tenantName: x })} />
          <PartyInput label="Landlord / manager" v={party.landlordName} onChange={(x) => setParty({ ...party, landlordName: x })} />
          <PartyInput label="Rental address" v={party.propertyAddress} onChange={(x) => setParty({ ...party, propertyAddress: x })} />
          <PartyInput label="Your mailing address" v={party.forwardingAddress} onChange={(x) => setParty({ ...party, forwardingAddress: x })} />
        </div>
        <pre className="print-letter max-h-[28rem] overflow-auto whitespace-pre-wrap p-6 font-sans text-sm leading-relaxed text-ink">
          {letter}
        </pre>
      </div>

      {/* Small claims guide */}
      <div className="card p-6">
        <SectionTitle>If they ignore the letter</SectionTitle>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info k="Where to file" v={j.smallClaims.forum} />
          <Info k="Claim limit" v={j.smallClaims.limit} />
          <Info k="Filing fee" v={j.smallClaims.filingFee} />
          <Info k="Time limit to sue" v={j.smallClaims.statuteOfLimitations} />
        </dl>
      </div>

      {/* Sources */}
      <div className="rounded-2xl bg-paper-2 p-6 text-sm text-ink-soft">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-medium text-ink">Sources</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${j.confidence === "high" ? "bg-emerald-soft text-emerald-deep" : "bg-amber-soft text-amber"}`}>
            {j.confidence} confidence
          </span>
        </div>
        <ul className="list-inside list-disc space-y-1">
          {j.sourceUrls.map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noopener noreferrer" className="text-emerald-deep underline decoration-line underline-offset-2 hover:text-emerald break-all">
                {u}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{j.caveats}</p>
        <p className="mt-3 text-xs text-muted">
          DepositBack is informational only and not legal advice. Verify {j.statuteCitation} and consider a local attorney or legal-aid office.
        </p>
      </div>
    </div>
  );
}

/* ── little primitives ─────────────────────────────────────────────────── */

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-ink">
        {label}
        {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{children}</h4>;
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

function PartyInput({ label, v, onChange }: { label: string; v?: string; onChange: (x: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input value={v ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={label} className="input" />
    </label>
  );
}

function UploadButton({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-gold hover:text-gold disabled:opacity-60"
      >
        {busy ? "Reading…" : "📷 Upload the statement"}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
