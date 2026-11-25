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

// GEMINI_MODEL may be a comma-separated list — we try each in order. The free
// tier's main Flash models get 503 "high demand", so we prefer the LITE models
// first (more free headroom, plenty for this simple shop assistant) and fall
// back to the full models. Override entirely via the GEMINI_MODEL env var.
const MODELS = (
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash-lite,gemini-flash-lite-latest,gemini-3.8-flash,gemini-flash-latest"
)
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

  // One quick retry per model (bounded latency since we try several models).
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const outcome = await callModel(model, key, body);
      if (outcome.kind === "ok") return outcome.text;
      if (outcome.kind === "retry" && attempt === 0) {
        await sleep(350);
        continue;
      }
      break; // non-retryable (or retried once) → try next model
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
