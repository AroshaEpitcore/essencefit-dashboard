import type { ChatTurn } from "@/lib/waGemini";
import * as claude from "@/lib/waClaude";
import * as gemini from "@/lib/waGemini";

/*
 * AI provider dispatcher for the WhatsApp bot. Picks the provider by which key
 * is configured — Claude (ANTHROPIC_API_KEY) is preferred for reliability;
 * Gemini (GEMINI_API_KEY) is the free-tier fallback. Swapping providers is a
 * Vercel env-var change, no code edit. Returns null if neither is configured
 * (the webhook then falls back to the deterministic 2a stock reply).
 */
export type { ChatTurn };

export async function generateReply(
  systemPrompt: string,
  history: ChatTurn[],
  userText: string
): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) {
    return claude.generateReply(systemPrompt, history, userText);
  }
  if (process.env.GEMINI_API_KEY) {
    return gemini.generateReply(systemPrompt, history, userText);
  }
  return null;
}
