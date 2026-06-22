// Minimal server-side Gemini client (REST, no SDK). Key stays on the server.

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GenerateOpts {
  parts: GeminiPart[];
  system?: string;
  temperature?: number;
}

/** Calls Gemini in JSON mode and returns the raw JSON string (caller validates with Zod). */
export async function geminiJSON({ parts, system, temperature = 0.2 }: GenerateOpts): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not configured on the server.", 500);

  const body = {
    contents: [{ role: "user", parts }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GeminiError("Could not reach Gemini. Check your network connection.", 503);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new GeminiError("Gemini rate limit hit (free tier). Wait a moment and try again.", 429);
    throw new GeminiError(`Gemini request failed (${res.status}). ${detail.slice(0, 240)}`, 502);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(`Gemini blocked the request (${data.promptFeedback.blockReason}).`, 422);
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new GeminiError("Gemini returned an empty response.", 502);
  return text;
}

/** Tolerant JSON parse — strips ```json fences if the model adds them. */
export function parseModelJSON(raw: string): unknown {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(s);
}
