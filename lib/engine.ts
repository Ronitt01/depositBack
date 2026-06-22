import type {
  CaseInput,
  CaseVerdict,
  ClassifiedDeduction,
  Currency,
  DeadlineFinding,
  Jurisdiction,
  RecoveryEstimate,
  VerdictTone,
} from "./types";

/* ── money & dates ─────────────────────────────────────────────────────── */

export function formatMoney(amount: number, currency: Currency): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Whole calendar days from `aISO` to `bISO` (b − a). Negative if b is before a. */
export function daysBetween(aISO: string, bISO: string): number {
  const a = Date.parse(aISO + "T00:00:00Z");
  const b = Date.parse(bISO + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/* ── deadline / forfeiture ─────────────────────────────────────────────── */

export function analyzeDeadline(j: Jurisdiction, input: CaseInput): DeadlineFinding {
  const deadlineDays = j.returnDeadline.days;
  const returned = input.returnedDate !== null;

  // India and any jurisdiction without a fixed statutory deadline.
  if (deadlineDays === null) {
    return {
      applicable: false,
      deadlineDays: null,
      daysTaken: returned ? daysBetween(input.moveOutDate, input.returnedDate!) : null,
      isLate: false,
      lateByDays: 0,
      returned,
      forfeitsAll: false,
      headline: "No fixed statutory deadline",
      detail: j.returnDeadline.note,
    };
  }

  const endISO = returned ? input.returnedDate! : input.asOfDate;
  const daysTaken = Math.max(0, daysBetween(input.moveOutDate, endISO));
  const isLate = daysTaken > deadlineDays;
  const lateByDays = Math.max(0, daysTaken - deadlineDays);
  const forfeitsAll = j.returnDeadline.forfeitsOnLate && isLate;

  let headline: string;
  if (!returned && isLate) {
    headline = `${daysTaken} days and still no deposit — ${lateByDays} past the ${deadlineDays}-day limit`;
  } else if (isLate) {
    headline = `Returned ${lateByDays} day${lateByDays === 1 ? "" : "s"} late (limit: ${deadlineDays} days)`;
  } else if (returned) {
    headline = `Returned within the ${deadlineDays}-day deadline`;
  } else {
    headline = `${daysTaken} of ${deadlineDays} days elapsed`;
  }

  let detail: string;
  if (forfeitsAll) {
    detail = `Because the landlord blew the ${deadlineDays}-day deadline, ${j.name} law (${j.statuteCitation}) forfeits their right to keep ANY of the deposit — even for real damage.`;
  } else if (isLate && !j.returnDeadline.forfeitsOnLate) {
    detail = `The ${deadlineDays}-day deadline is blown. In ${j.name} that doesn't auto-forfeit the deposit, but it raises a presumption of bad faith that unlocks penalties.`;
  } else if (isLate) {
    detail = j.returnDeadline.note;
  } else {
    detail = `The clock runs from ${j.returnDeadline.trigger}.`;
  }

  return { applicable: true, deadlineDays, daysTaken, isLate, lateByDays, returned, forfeitsAll, headline, detail };
}

/* ── recovery & penalty estimate ───────────────────────────────────────── */

export function estimateRecovery(
  j: Jurisdiction,
  input: CaseInput,
  forfeitsAll: boolean,
): RecoveryEstimate {
  const ded = input.deductions;
  const sum = (arr: ClassifiedDeduction[]) => arr.reduce((t, d) => t + (d.amount || 0), 0);

  const totalDeducted = sum(ded);
  const illegalSum = sum(ded.filter((d) => d.verdict === "illegal"));
  const ambiguousSum = sum(ded.filter((d) => d.verdict === "ambiguous"));

  // What the landlord actually kept: the balance they didn't return, or the whole deposit if nothing came back.
  const withheld = input.returnedDate ? totalDeducted : Math.max(totalDeducted, input.depositAmount);

  // Firm "owed back" figure: everything if they forfeited the right to deduct, else the clearly-illegal lines.
  const baseOwed = forfeitsAll ? withheld : illegalSum;

  const mult = j.penalty.multiplier;
  const flat = j.penalty.flat ?? 0;
  const penaltyApplies = mult !== null && j.penalty.condition !== "none" && baseOwed > 0;
  const penaltyAmount = penaltyApplies ? baseOwed * (mult as number) + flat : 0;

  const estimate: RecoveryEstimate = {
    currency: j.currency,
    totalDeducted,
    illegalSum,
    ambiguousSum,
    baseOwed,
    penalty: {
      applies: penaltyApplies,
      multiplier: mult,
      condition: j.penalty.condition,
      flat,
      amount: penaltyAmount,
      note: j.penalty.note,
    },
    totalLow: baseOwed,
    totalHigh: baseOwed + penaltyAmount,
  };

  // Over-cap collection (India 2 months, Colorado 1 month).
  if (j.depositCap && input.monthlyRent && input.monthlyRent > 0) {
    const capAmount = j.depositCap.months * input.monthlyRent;
    if (input.depositAmount > capAmount + 1) {
      estimate.depositCapFlag = {
        capMonths: j.depositCap.months,
        capAmount,
        overBy: input.depositAmount - capAmount,
        note: j.depositCap.note,
      };
    }
  }

  return estimate;
}

/* ── full verdict ──────────────────────────────────────────────────────── */

function pickTone(deadline: DeadlineFinding, recovery: RecoveryEstimate): VerdictTone {
  const hasMoney = recovery.baseOwed > 0;
  const hasCap = !!recovery.depositCapFlag;
  if (deadline.forfeitsAll || (hasMoney && recovery.penalty.applies && recovery.penalty.condition === "automatic")) {
    return "strong";
  }
  if (hasMoney || hasCap) return "mixed";
  if (!deadline.applicable) return "info";
  return "weak";
}

export function buildVerdict(j: Jurisdiction, input: CaseInput): CaseVerdict {
  const deadline = analyzeDeadline(j, input);
  const recovery = estimateRecovery(j, input, deadline.forfeitsAll);
  const tone = pickTone(deadline, recovery);

  let headline: string;
  if (deadline.forfeitsAll) {
    headline = `Your landlord likely owes you the full ${formatMoney(recovery.baseOwed, j.currency)} back.`;
  } else if (recovery.baseOwed > 0) {
    headline = `At least ${formatMoney(recovery.baseOwed, j.currency)} of these deductions looks illegal.`;
  } else if (recovery.depositCapFlag) {
    headline = `Your deposit is ${formatMoney(recovery.depositCapFlag.overBy, j.currency)} over the legal cap.`;
  } else if (!deadline.applicable) {
    headline = `Here's what ${j.name} law lets your landlord keep — and what it doesn't.`;
  } else {
    headline = `These deductions look defensible — but here's how to double-check.`;
  }

  return { jurisdiction: j, deadline, recovery, tone, headline };
}
