/*
 * Minimal Gemini (Google AI Studio) client — the AI provider for the WhatsApp
 * bot (Phase 2b). Uses the REST API directly (no SDK dependency).
 *
 * Provider-swappable by design: the bot only calls `generateReply(...)`. To move
 * to Claude later, add a sibling module with the same signature and switch the
 * import in waAgent.ts — no other code changes. (See memory: Claude is the
 * documented fallback if Gemini's Singlish quality disappoints.)
 *
 * Env:
 *   GEMINI_API_KEY  — free key from https://aistudio.google.com/api-keys
 *   GEMINI_MODEL    — (optional) override the model name
 */

export type ChatTurn = { role: "user" | "model"; text: string };

// gemini-2.0-flash was retired; 3.8-flash is current. GEMINI_MODEL may be a
// comma-separated list — we try each in order (handy for a lighter fallback
// when the main model is overloaded), e.g. "gemini-3.8-flash,gemini-flash-latest".
const MODELS = (process.env.GEMINI_MODEL || "gemini-3.8-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Returns the model's reply text, or null if the AI is unavailable — callers
 * fall back to the deterministic 2a path so the bot never goes silent.
 *
 * Resilience: 429/503 are transient ("high demand"), so we retry with short
 * backoff; a 404 means the model name is wrong, so we skip to the next model.
 */
export async function generateReply(
  systemPrompt: string,
  history: ChatTurn[],
  userText: string
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: userText }] },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
  });

  for (const model of MODELS) {
    // Retry transient overloads on this model before moving on.
    for (let attempt = 0; attempt < 3; attempt++) {
      const outcome = await callModel(model, key, body);
      if (outcome.kind === "ok") return outcome.text;
      if (outcome.kind === "retry" && attempt < 2) {
        await sleep(400 * (attempt + 1)); // 400ms, then 800ms
        continue;
      }
      break; // non-retryable (or retries exhausted) → try next model
    }
  }
  return null;
}

type CallOutcome =
  | { kind: "ok"; text: string | null }
  | { kind: "retry" }
  | { kind: "fail" };

async function callModel(model: string, key: string, body: string): Promise<CallOutcome> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body }
    );

    if (res.ok) {
      const json = (await res.json()) as GeminiResponse;
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? "").join("").trim();
      return { kind: "ok", text: text || null };
    }

    const detail = await res.text().catch(() => "");
    console.error(`[wa/gemini] ${model} ${res.status}: ${detail.slice(0, 200)}`);
    // 429 rate-limited / 503 overloaded → worth retrying the same model.
    if (res.status === 429 || res.status === 503) return { kind: "retry" };
    return { kind: "fail" };
  } catch (err) {
    console.error(`[wa/gemini] ${model} fetch failed:`, err);
    return { kind: "retry" };
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};
