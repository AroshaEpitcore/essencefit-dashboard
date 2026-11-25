# WhatsApp AI Bot — Progress Tracker

Auto-handle Meta-ad WhatsApp inquiries 24/7: FAQs, stock/price/colour answers, and order capture.
Last updated: **2026-11-19**

---

## Key references

| Thing | Value |
|---|---|
| Meta app | "EssenceFit", App ID `1117599673835710` |
| Test number | **+1 555 169 0011** (Phone Number ID `1396464750225919`) |
| WABA / messaging acct | `2155106741748530` |
| Webhook URL | `https://essencefit.lk/api/wa/webhook` |
| Webhook code | `src/app/api/wa/webhook/route.ts` |
| Owner test phone | `94762946381` (0762946381) |
| Bot number strategy | NEW/second number for bot; current number stays manual |
| Expected volume | ~1,000 ad messages/month (~200/week) |

### Env vars (Vercel)
- `WHATSAPP_VERIFY_TOKEN` — handshake secret (matches Meta's "Verify token" box)
- `WHATSAPP_TOKEN` — **permanent System User token** ("EssenceFit Bot", never expires) ✅
- `WHATSAPP_PHONE_NUMBER_ID` — `1396464750225919`
- `WHATSAPP_APP_SECRET` — (optional) verifies Meta's signature; skipped if unset
- `WHATSAPP_GRAPH_VERSION` — (optional) defaults to `v21.0`
- `ANTHROPIC_API_KEY` — ✅ **SET (current provider)** — pay-per-use Claude key from platform.claude.com. Powers the bot via **Claude Haiku 5.5** (cheapest tier, ~Rs 0.25–1/month at this volume, reliable — no free-tier quota walls).
- `CLAUDE_MODEL` — (optional) override the Claude model id; defaults to `claude-haiku-5-5`.
- `GEMINI_API_KEY` — *free-tier fallback, not primary.* Still wired (`waGemini.ts`); used only if `ANTHROPIC_API_KEY` is unset. Hit free-tier 429/503 limits in testing — the reason we moved to Claude.
- `GEMINI_MODEL` — (optional) Gemini model override.

> **Provider decision (2026-11-25):** switched Phase 2b from Gemini to **Claude Haiku 5.5**. Gemini's free tier worked in code but kept hitting 503 (overload) then 429 (daily quota) — unreliable for a real bot. Claude Haiku 5.5 is dirt-cheap at this volume and reliable. The AI layer is provider-swappable via `src/lib/waAi.ts` (picks Claude if `ANTHROPIC_API_KEY` set, else Gemini), so switching back is an env change.

---

## Phase 0 — Meta setup & proof of life ✅ DONE

- [x] Meta Developer app exists (WhatsApp + Webhooks products added)
- [x] Claimed free test number; fixed 131000 / missing-permissions error
- [x] Sent a template message, got `status=delivered` to a verified SL recipient
- [x] Confirmed cost model: inbound ad flow ≈ Rs 0 (72h free window); only proactive templates are paid (~Rs 6–15 each)

## Phase 1 — Webhook + auto-reply ✅ DONE & PROVEN

- [x] Built `route.ts`: GET verify handshake + POST handler (canned text reply)
- [x] Optional `X-Hub-Signature-256` verification
- [x] Deployed to production, merged to `main` (merge commit `1c5edc1`)
- [x] Meta Configuration: Callback URL + verify token saved (green), subscribed to `messages` (v27.0)
- [x] App switched to **Live** mode (needed Privacy Policy URL → used `https://essencefit.lk/privacy-policy`)
- [x] **Root-cause fix for "no real inbound"**: subscribed app to WABA via `POST /{2155106741748530}/subscribed_apps` → `{"success":true}`. Real "hi" now triggers the auto-reply.
- [x] **Permanent System User token** created ("EssenceFit Bot", Full control, perms `whatsapp_business_messaging` + `whatsapp_business_management`, expiration **Never**). Set as `WHATSAPP_TOKEN` in Vercel + redeployed; reply still works → no token-expiry risk.

**Known non-issue:** `feat/whatsapp-webhook` preview build FAILS (no `DATABASE_URL` in Preview env → `/about` + promos prerender ECONNREFUSED 5432). Harmless — production is fine.

---

## Phase 2 — Make it smart (in progress)

- [x] **2a. Live-stock reply (no AI key needed)** ✅ DONE 2026-11-23
  - [x] Pulled the stock query out from behind `requireAdmin()` into `src/lib/waStock.ts` (`getSizesWithColorsForCategory`, `getStockBySize`); admin `getSizesWithColors` now reuses it
  - [x] Webhook detects a bare size (`30/32/34/36`, `S/M/L/XL/XXL/3XL`, word forms `Small/Medium/Large`) → `getStockBySize` → replies with live colours + qty grouped by product
  - [x] **Size-alias normalisation**: catalog stores both `M` & `Medium`, `3XL` & `XXXL` as separate rows → `expandSizeAliases` matches all variants case-insensitively so no stock is silently missed
  - [x] Industry touches: webhook **de-dupe** by message id (Meta re-delivers), **read receipts** (blue ticks), graceful error replies
  - [x] Verified end-to-end against live DB (read-only single query): `L`→15 rows, `30`→Corduroy Shorts ×5 colours, `3XL`→Plain Skinner
  - **Known limitation (ok for MVP):** a common size like `M` returns ALL products in that size (wall of text). Phase 2b will scope to one product (via the ad referral / conversation). ← *this is the owner's #1 ask*
  - Supabase pooler: bot shares the same pooled `getDb()` — no new connection path (see memory `dont-load-test-live-db`)
  - **DEPLOYED to production 2026-11-24** (commits `7f722cd` feat + `b20251e` chore → `main`; Vercel deploy `success`). Verified: `tsc` clean, 31/31 unit tests pass, live dry-run correct, webhook GET handshake 403 on prod. **Real end-to-end test:** message `30` to the test number +1 555 169 0011 → expect live Corduroy Shorts colours.
- [x] **2b. AI layer — Gemini (provider-swappable; Claude = fallback)** BUILT 2026-11-25
  - [x] `GEMINI_API_KEY` added to Vercel (free AI Studio key)
  - [x] Provider adapter: `src/lib/waGemini.ts` (`generateReply`, model `gemini-2.0-flash`, env-overridable `GEMINI_MODEL`); Claude swaps in behind the same signature
  - [x] **Conversation memory**: `wa_conversations` table + `src/lib/waConvo.ts` (remembers ad product, honorific, profile name, last 12 turns) — migration `db/pg/patches/2026-11-25-wa-conversations.sql` (applied to prod)
  - [x] **Brain**: `src/lib/waAgent.ts` — grounds Gemini with the live catalog + real stock for any size mentioned, so it never invents numbers; scopes to the ad's product; **falls back to 2a** if the AI is unavailable (bot never goes silent)
  - [x] **Product scoping** — ad `referral` captured on first inbound, matched to a catalog product; AI answers for that product and offers others on request
  - [x] **Send images** — AI emits `[[IMG:size-chart]]` / `[[IMG:colours]]` → bot sends the public images at `essencefit.lk/wa/*` (parser `parseImageTags`, unit-tested)
  - [x] **Honorifics (sir/miss/dear)** — profile name passed to the AI; instructed man→sir, lady→miss, **unknown→dear**
  - [x] `tsc` clean, **34/34 unit tests pass**, production build green
  - [ ] **Pilot-validate Singlish quality on real messages** (do after deploy — message the bot)
  - [ ] *Enhancement:* per-product photos via `products.imageurl` (currently only the two generic `/wa/` images)
- [ ] **2c. Order placement**
  - [ ] Wrap `createOrder` as a tool the model can call (stays concurrency-safe via `fn_available_qty` / `deduct_stock`)
  - [ ] Decide: v1 places orders, or only answers + hands off to human

---

## Open decisions / parking lot

- [ ] Register the **real bot SIM** eventually (test number works for dev, but a production number is cleaner) — then set `WHATSAPP_PHONE_NUMBER_ID` to the new id in Vercel + redeploy
- [ ] Confirm SL template rate on Meta rate card
- [ ] Add success-path logging to the webhook (currently only `console.error` on failure)

## Reference artifacts
- English build guide: https://claude.ai/code/artifact/2fd2e3b4-75c6-43b8-8b12-5a414a5291f9
- Sinhala build guide: https://claude.ai/code/artifact/0b37013b-852a-4e51-b1c0-ca3bfebd6cd5
