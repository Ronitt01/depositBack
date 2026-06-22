// Shared types for DepositBack.

export type Currency = "USD" | "INR";
export type PenaltyCondition = "automatic" | "bad-faith" | "discretionary" | "none";
export type Confidence = "high" | "medium" | "low";

export interface Jurisdiction {
  /** Stable code, e.g. "US-CA" or "IN". */
  code: string;
  /** Human label, e.g. "California". */
  name: string;
  country: "US" | "IN";
  currency: Currency;
  /** Short label shown in the picker. */
  short: string;

  returnDeadline: {
    /** Calendar days the landlord has to return/account for the deposit. null = no fixed statutory deadline (India). */
    days: number | null;
    /** What starts the clock. */
    trigger: string;
    /** Does missing the deadline forfeit the landlord's right to withhold ANY of the deposit? */
    forfeitsOnLate: boolean;
    note: string;
  };

  itemizedStatement: { required: boolean; rule: string };

  penalty: {
    /** Damages multiple of the wrongfully-withheld amount, e.g. 2 or 3. null = none. */
    multiplier: number | null;
    condition: PenaltyCondition;
    /** Fixed statutory amount added on top, in the jurisdiction currency (e.g. Texas $100). */
    flat?: number;
    note: string;
  };

  /** Statutory cap on the deposit, expressed in months of rent (used to flag over-collection). */
  depositCap?: { months: number; note: string };

  wearAndTear: { nonDeductible: string[]; note: string };

  statuteCitation: string;
  sourceUrls: string[];

  smallClaims: {
    limit: string;
    filingFee: string;
    statuteOfLimitations: string;
    forum: string;
  };

  voidClauses: string[];
  confidence: Confidence;
  caveats: string;
}

export type DeductionVerdict = "illegal" | "legitimate" | "ambiguous";

export interface DeductionLine {
  id: string;
  text: string;
  amount: number;
}

export interface ClassifiedDeduction extends DeductionLine {
  verdict: DeductionVerdict;
  /** Plain-English reason, grounded in the jurisdiction's wear-and-tear rule. */
  reason: string;
  /** Which wear-and-tear example / rule it matched, if any. */
  basis?: string;
}

export interface LeaseClauseFlag {
  clause: string;
  isLikelyVoid: boolean;
  reason: string;
}

/** Result of the Gemini analyze route (Zod-validated server-side). */
export interface AnalyzeResult {
  deductions: ClassifiedDeduction[];
  leaseFlags: LeaseClauseFlag[];
}

/** Result of the Gemini OCR route (Zod-validated server-side) — shown for user verification. */
export interface OcrResult {
  depositAmount: number | null;
  moveOutDate: string | null;
  returnedDate: string | null;
  deductions: { text: string; amount: number }[];
  rawText: string;
}

export interface CaseInput {
  jurisdictionCode: string;
  depositAmount: number;
  monthlyRent?: number;
  moveOutDate: string; // ISO yyyy-mm-dd
  returnedDate: string | null; // ISO; null = not returned at all
  /** "today" anchor for deterministic day math (passed in so the engine stays pure). */
  asOfDate: string; // ISO
  deductions: ClassifiedDeduction[];
}

export interface DeadlineFinding {
  applicable: boolean; // false for India (no fixed deadline)
  deadlineDays: number | null;
  daysTaken: number | null;
  isLate: boolean;
  lateByDays: number;
  returned: boolean;
  forfeitsAll: boolean;
  headline: string;
  detail: string;
}

export interface RecoveryEstimate {
  currency: Currency;
  totalDeducted: number;
  illegalSum: number;
  ambiguousSum: number;
  /** Amount we argue the tenant is owed back (firm). */
  baseOwed: number;
  penalty: {
    applies: boolean;
    multiplier: number | null;
    condition: PenaltyCondition;
    flat: number;
    amount: number; // computed statutory penalty exposure (conditional)
    note: string;
  };
  totalLow: number; // just the deposit back
  totalHigh: number; // deposit back + max statutory exposure
  depositCapFlag?: { capMonths: number; capAmount: number; overBy: number; note: string };
}

export type VerdictTone = "strong" | "mixed" | "weak" | "info";

export interface CaseVerdict {
  jurisdiction: Jurisdiction;
  deadline: DeadlineFinding;
  recovery: RecoveryEstimate;
  tone: VerdictTone;
  headline: string;
}
