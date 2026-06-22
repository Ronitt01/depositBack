# DepositBack — *Get your security deposit back*

Your landlord kept your deposit. DepositBack checks what they did against the **real statute** for your
state (or India), computes what you're actually owed, and writes a citation-backed **demand letter** —
in about ten seconds, with no login.

> Day 8 of "10 apps in 10 days." The moat is **grounded verification**: deadlines, penalties, and
> citations come from a hand-verified law table + deterministic math, not from a model's memory.

## What it does

- **Deadline + forfeiture check** — deterministic date math against each jurisdiction's statutory return
  deadline. In states where a blown deadline forfeits the landlord's right to withhold *anything*, it says so.
- **Deduction audit** — Gemini 2.5 Flash classifies each line as *likely illegal* (normal wear and tear),
  *probably valid* (real damage), or *needs proof*, grounded in that jurisdiction's wear-and-tear rule.
  Amounts are always re-anchored to your input — the model never does the arithmetic.
- **Penalty estimator** — shows statutory exposure (e.g. 2×/3× damages) with honest *conditional* language
  (automatic vs. bad-faith-only).
- **Demand letter** — a deterministic, mail-ready letter with your facts, the real citation, and per-line
  verdicts. Copy or print to PDF.
- **Small-claims guide** — where to file, the limit, the fee, and the time limit to sue.
- **Lease-clause check** — paste a clause; we flag likely-void terms (auto cleaning fees, non-refundable
  deposits, forfeiture clauses).
- **Photo OCR** — snap the itemized statement; Gemini vision extracts the lines, then **you verify every
  line** before the verdict is computed (extraction never silently drives the result).

## Jurisdictions (verified, with sources)

California · Texas · New York · Florida · Chicago (IL, RLTO) · Massachusetts · Colorado · Washington · **India**
(Model Tenancy Act, 2021). India has no fixed return deadline and no damages multiplier — the engine branches
to the deposit-cap (2 months) and reasonable-deductions analysis instead.

Each record carries its statute citation, source URLs, a confidence rating, and caveats. See
[`lib/jurisdictions.ts`](lib/jurisdictions.ts).

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Google Gemini 2.5 Flash** (server-side, JSON mode) validated with **Zod** — deduction/lease analysis + OCR only
- **React Three Fiber + drei + postprocessing** — the cinematic scroll-flythrough hero
- **Framer Motion** for micro-interactions · No database · Stateless

## Run locally

```bash
npm install
cp .env.example .env.local   # add your Gemini key (free: https://aistudio.google.com/apikey)
npm run dev                  # http://localhost:3000
```

The **"Try an example"** demos (California padded bill · India over-cap) run **fully offline** — no key needed.
The "Check my deposit" analysis and photo OCR call Gemini, so they need `GEMINI_API_KEY`.

## Disclaimer

DepositBack is **informational only and not legal advice**, and does not create an attorney–client
relationship. Always verify the cited statute and consider a local attorney or legal-aid office.
