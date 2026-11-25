import Anthropic from "@anthropic-ai/sdk";
import type { ChatTurn } from "@/lib/waGemini";

/*
 * Claude (Anthropic) provider for the WhatsApp bot — same generateReply()
 * signature as waGemini, so waAi.ts can pick either. Uses the official SDK,
 * which auto-retries 429/5xx with backoff (no hand-rolled retry needed) and
 * has far higher availability than Gemini's free tier.
 *
 * Env:
 *   ANTHROPIC_API_KEY — the pay-per-use key from platform.claude.com
 *   CLAUDE_MODEL      — (optional) override the model id
 *
 * Default model: Claude Haiku 5.5 — cheapest tier ($0.10/$0.50 per MTok),
 * built for high-volume low-latency chat/routing. Overridable if the id ever
 * changes (a wrong id just 404s → we return null → the bot falls back to 2a).
 */

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";

// Single client; reads ANTHROPIC_API_KEY from the environment.
let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Returns the model's reply text, or null if the AI is unavailable (no key,
 * API error, empty response) — callers fall back to the deterministic 2a path.
 */
export async function generateReply(
  systemPrompt: string,
  history: ChatTurn[],
  userText: string
): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        // Our ChatTurn uses "user"/"model"; Anthropic uses "user"/"assistant".
        ...history.map((h) => ({
          role: h.role === "model" ? ("assistant" as const) : ("user" as const),
          content: h.text,
        })),
        { role: "user" as const, content: userText },
      ],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("[wa/claude] request failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
