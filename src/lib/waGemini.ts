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
 *   GEMINI_MODEL    — (optional) defaults to gemini-2.0-flash
 */

export type ChatTurn = { role: "user" | "model"; text: string };

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/**
 * Returns the model's reply text, or null if the AI is unavailable (no key, API
 * error, empty response) — callers fall back to the deterministic 2a path so the
 * bot never goes silent.
 */
export async function generateReply(
  systemPrompt: string,
  history: ChatTurn[],
  userText: string
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[wa/gemini] ${res.status}: ${detail.slice(0, 300)}`);
      return null;
    }

    const json = (await res.json()) as GeminiResponse;
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    return text || null;
  } catch (err) {
    console.error("[wa/gemini] fetch failed:", err);
    return null;
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};
