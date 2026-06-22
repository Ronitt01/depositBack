import { z } from "zod";
import { geminiJSON, parseModelJSON, GeminiError } from "@/lib/gemini";
import type { OcrResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const RequestSchema = z.object({
  imageBase64: z.string().min(16),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
});

const ModelSchema = z.object({
  depositAmount: z.number().nullable(),
  moveOutDate: z.string().nullable(),
  returnedDate: z.string().nullable(),
  deductions: z.array(z.object({ text: z.string(), amount: z.number() })).max(40),
  rawText: z.string().default(""),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = RequestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid image upload." }, { status: 400 });
  }

  const system =
    "You extract structured data from a photo or PDF of a landlord's security-deposit itemized statement " +
    "or move-out accounting. You transcribe ONLY what is visible — never invent amounts or dates. Output ONLY JSON.";

  const task =
    "From the attached document, extract: the original security deposit amount (depositAmount, number or null); " +
    "the tenant's move-out date (moveOutDate as YYYY-MM-DD or null); the date the deposit/balance was returned " +
    "(returnedDate as YYYY-MM-DD or null); and every line-item deduction (deductions: [{text, amount}]). " +
    "Also include a short rawText of the key lines you read. If a value is not clearly present, use null. " +
    'Return JSON: {"depositAmount","moveOutDate","returnedDate","deductions":[{"text","amount"}],"rawText"}.';

  let result: OcrResult;
  try {
    const raw = await geminiJSON({
      parts: [{ text: task }, { inlineData: { mimeType: parsed.mimeType, data: parsed.imageBase64 } }],
      system,
      temperature: 0,
    });
    result = ModelSchema.parse(parseModelJSON(raw));
  } catch (err) {
    if (err instanceof GeminiError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Could not read that file. Try a clearer photo, or enter the details by hand." }, { status: 502 });
  }

  return Response.json(result);
}
