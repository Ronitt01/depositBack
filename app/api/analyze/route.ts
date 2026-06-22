import { z } from "zod";
import { getJurisdiction } from "@/lib/jurisdictions";
import { geminiJSON, parseModelJSON, GeminiError } from "@/lib/gemini";
import type { ClassifiedDeduction, LeaseClauseFlag } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const RequestSchema = z.object({
  jurisdictionCode: z.string(),
  deductions: z
    .array(z.object({ text: z.string().min(1), amount: z.number().nonnegative() }))
    .max(40),
  leaseClause: z.string().max(8000).optional(),
});

const ModelSchema = z.object({
  deductions: z.array(
    z.object({
      text: z.string(),
      amount: z.number(),
      verdict: z.enum(["illegal", "legitimate", "ambiguous"]),
      reason: z.string(),
      basis: z.string().optional(),
    }),
  ),
  leaseFlags: z
    .array(
      z.object({
        clause: z.string(),
        isLikelyVoid: z.boolean(),
        reason: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = RequestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const j = getJurisdiction(parsed.jurisdictionCode);
  if (!j) return Response.json({ error: "Unknown jurisdiction." }, { status: 400 });
  if (parsed.deductions.length === 0 && !parsed.leaseClause) {
    return Response.json({ deductions: [], leaseFlags: [] });
  }

  const system =
    `You are a careful tenant-rights analyst for ${j.name}. You classify a landlord's security-deposit ` +
    `deductions strictly against THIS jurisdiction's wear-and-tear rules, and you flag unenforceable lease clauses. ` +
    `You never invent statutes or numbers. When a deduction could be legitimate with documentation, mark it "ambiguous", ` +
    `not "illegal". Output ONLY JSON.`;

  const rules =
    `JURISDICTION: ${j.name} (${j.statuteCitation})\n` +
    `NON-DEDUCTIBLE NORMAL WEAR AND TEAR (examples): ${j.wearAndTear.nonDeductible.join("; ")}.\n` +
    `RULE: ${j.wearAndTear.note}\n` +
    `VOID/UNENFORCEABLE LEASE CLAUSE TYPES: ${j.voidClauses.join("; ")}.`;

  const task =
    `${rules}\n\n` +
    `Classify each deduction below as "illegal" (normal wear and tear / not chargeable), "legitimate" ` +
    `(actual damage beyond normal use, chargeable with documentation), or "ambiguous" (depends on documentation/severity). ` +
    `Give a one-sentence plain-English reason grounded in the rule above, and a "basis" naming the matching wear-and-tear example when relevant.\n\n` +
    `DEDUCTIONS:\n${parsed.deductions.map((d, i) => `${i + 1}. ${d.text} — ${d.amount}`).join("\n") || "(none)"}\n\n` +
    (parsed.leaseClause
      ? `LEASE CLAUSE TO REVIEW (flag any unenforceable parts):\n"""${parsed.leaseClause}"""\n\n`
      : "") +
    `Return JSON of shape: {"deductions":[{"text","amount","verdict","reason","basis"?}], "leaseFlags":[{"clause","isLikelyVoid","reason"}]}. ` +
    `Echo each deduction's text and amount exactly. If no lease clause was provided, return an empty leaseFlags array.`;

  let model;
  try {
    const raw = await geminiJSON({ parts: [{ text: task }], system, temperature: 0.15 });
    model = ModelSchema.parse(parseModelJSON(raw));
  } catch (err) {
    if (err instanceof GeminiError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Could not analyze the deductions. Please try again." }, { status: 502 });
  }

  // Re-anchor amounts to the user's input (never trust the model's arithmetic) and attach ids.
  const deductions: ClassifiedDeduction[] = parsed.deductions.map((input, i) => {
    const m = model.deductions[i];
    return {
      id: String(i + 1),
      text: input.text,
      amount: input.amount,
      verdict: m?.verdict ?? "ambiguous",
      reason: m?.reason ?? "Could not classify this line — request documentation from your landlord.",
      basis: m?.basis,
    };
  });

  const leaseFlags: LeaseClauseFlag[] = (model.leaseFlags ?? []).map((f) => ({
    clause: f.clause,
    isLikelyVoid: f.isLikelyVoid,
    reason: f.reason,
  }));

  return Response.json({ deductions, leaseFlags });
}
