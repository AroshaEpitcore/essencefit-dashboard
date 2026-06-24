---
date: 2026-06-23
topic: "Navbar not auto-updating after order placement, and the perception that account/order pages are viewable without login"
repo_commit: 6d409fa
branch: research/supabase-migration
status: complete
tags: [research, storefront, customer-auth, navbar, session]
---

# Research: Customer auth guard & navbar login-state refresh

## Research Question
(1) After placing an order the storefront navbar does **not** auto-update to show the
signed-in account — it requires a manual full refresh. Why? (2) Account pages and order
details *appear* viewable **without** being logged in. Is there an actual auth bypass, and
where is the guard?

## Summary

**The two symptoms share a single root cause: the navbar's login state is fetched once on
mount and never refreshed, so it goes stale.**

1. **Navbar staleness (real).** `AccountMenu` (`src/components/shop/AccountMenu.tsx`) learns
   login state by calling the `getMyAccount()` server action inside a `useEffect(() => …, [])`
   that runs **once on mount**. `StoreHeader` lives in the persistent `(shop)/layout.tsx`,
   which is **not remounted** on client-side navigation (Next.js App Router keeps layouts
   mounted). `createWebOrder` sets the session cookie server-side (`setSessionCookie`,
   `checkout/actions.ts:247`) and the checkout page does `router.push('/order/…')` — but the
   already-mounted `AccountMenu` gets no signal to re-fetch, so it keeps its initial
   signed-out state until a full page reload. The `(shop)` layout passes only
   `settings`/`categories` to `StoreHeader` — **never the current customer** — so there is no
   server-rendered login state that `router.refresh()` could update either.

2. **"Viewable without login" is a perception, NOT a data leak.** Every account/order
   surface is correctly gated on the signed session. The customer almost certainly **is**
   logged in via the persistent 30-day `ef_customer` cookie (set when their earlier order
   auto-created an account), while the stale navbar shows the signed-out icon — so it *looks*
   like "no login, yet I can see my account." All data accessors return null/empty without a
   valid session; the server-rendered pages `redirect()` to login.

## Detailed Findings

### Navbar / login-state read
- `src/components/shop/AccountMenu.tsx:25-27` — `useEffect(() => { getMyAccount().then(setMe)… }, [])`.
  Fetches login state **once**; `me` stays `null` until a remount. Renders the signed-out
  `<User>` icon when `me` is null, initials + dropdown when set.
- `src/app/(shop)/layout.tsx:4,25` — renders `<StoreHeader settings={settings} categories={categories} />`;
  **no customer prop**, so the header has no server-provided/refreshable login state.
- Next.js App Router keeps the layout (and thus `StoreHeader`/`AccountMenu`) mounted across
  `router.push`/`router.refresh`, so the mount-only effect never re-runs.

### Session lifecycle
- `src/lib/customerAuth.ts:11-12,65-79` — signed `ef_customer` cookie, **30-day** `MAX_AGE`;
  `setSessionCookie(customerId)` / `clearSessionCookie()`.
- `src/app/(shop)/checkout/actions.ts:246-247` — after a successful order for a logged-out
  buyer, `createWebOrder` auto-signs them in: `if (accountReady && wantsAccount) await setSessionCookie(customerId)`.
- `src/app/(shop)/checkout/page.tsx` — calls `createWebOrder` then `router.push('/order/${orderId}?placed=1')`.
  No header refresh signal.
- Logout path: `AccountMenu.logout()` → `logoutCustomer()` (`account/actions.ts:91-94` →
  `clearSessionCookie`) → `router.refresh()`; the component locally `setMe(null)`, so logout
  *does* visually update (it owns the state), but login (from checkout) does not.

### Auth guards — account & order pages (all gated)
- `src/app/(shop)/account/page.tsx:9,23-25` — `force-dynamic`; **server** guard
  `const me = await getCurrentCustomer(); if (!me) redirect("/account/login?next=/account")`.
- `src/app/(shop)/account/orders/page.tsx:8,22-25` — same server guard + `getMyOrders()`.
- `src/app/(shop)/order/[id]/page.tsx:9,44-45` — `force-dynamic`; `getCurrentCustomer()` →
  `redirect("/account/login?next=/order/${id}")` when not signed in; then `getMyOrder(id)`
  (returns null → `notFound()` if the order isn't theirs).
- `src/app/(shop)/account/profile/page.tsx:1,18-24` — **client** component; guard is
  client-side: `getMyAccount().then(me => { if (!me) router.replace(login) })`, shows a
  spinner until resolved. No data leak (the data accessor is gated), but the guard style
  differs from the server-rendered pages (brief client render before redirect).

### Data accessors — all return empty/null without a session
- `src/app/(shop)/account/actions.ts:96-98` — `getMyAccount()` ⇒ `getCurrentCustomer()` (null if no cookie).
- `src/app/(shop)/account/actions.ts:119-121` — `getMyOrders()`: `const me = await getCurrentCustomer(); if (!me) return [];`
- `getMyOrder(id)` (`account/actions.ts:242-244`) and `getMyDtfOrder(id)` (`:193-195`) —
  `if (!me) return null`, and the SQL further scopes by `CustomerId=@Cid OR phone/email match`,
  so one customer can't read another's order even with a valid session.

## Code References
- `src/components/shop/AccountMenu.tsx:25-27` — mount-only `getMyAccount()` fetch (staleness source).
- `src/app/(shop)/layout.tsx:25` — `StoreHeader` rendered without a customer prop.
- `src/app/(shop)/checkout/actions.ts:246-247` — auto-sign-in after order (server cookie set).
- `src/app/(shop)/checkout/page.tsx` — `router.push` after order; no header refresh.
- `src/lib/customerAuth.ts:49-62,65-79` — `getCurrentCustomer` / cookie set/clear.
- `src/app/(shop)/account/page.tsx:23-25`, `account/orders/page.tsx:22-25`,
  `order/[id]/page.tsx:44-45` — server-side redirect guards.
- `src/app/(shop)/account/profile/page.tsx:18-24` — client-side guard (spinner → redirect).
- `src/app/(shop)/account/actions.ts:96-98,119-121` — gated data accessors.

## Architecture / Conventions Observed
- **Server components guard with `redirect()` + `getCurrentCustomer()`** (account, orders,
  order detail). **Client components guard with `router.replace()` after a `getMyAccount()`
  fetch** (profile, and effectively the navbar). The mix is the inconsistency: anything that
  reads login state purely on the client only reflects the state **as of mount**.
- Login state is **never lifted to the server-rendered layout**, so there's no single source
  the header can re-render from on `router.refresh()`.
- The `ef_customer` cookie is `httpOnly`, so client code cannot read it directly — the only
  way the client learns login state is the `getMyAccount()` round-trip.

## Related Prior Work (from workflow/)
- `workflow/plans/2026-06-23-supabase-migration.md` — the data layer these flows run on now
  (Supabase/Postgres via the shim); unrelated to auth logic but same branch.
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` — original storefront
  build (account/checkout introduced there).

## Open Questions
1. **Refresh mechanism**: should login state be lifted into `(shop)/layout.tsx` (server-fetch
   `getCurrentCustomer()` → pass to `StoreHeader`/`AccountMenu` as initial state) so a
   `router.refresh()` after login/logout updates it? Or keep it client-side and re-fetch on
   pathname change / via a shared client context that checkout updates?
2. **Post-checkout signal**: checkout currently `router.push`es; would adding `router.refresh()`
   (plus server-provided header state) be enough to update the navbar without a shared store?
3. **Profile guard consistency**: convert `/account/profile` to a server-guarded shell to
   match the other account pages, or leave the client guard?
4. Confirm there is genuinely no caching surprise: all these pages are `force-dynamic`, so the
   staleness is purely the client mount-only fetch — verify no other entry path renders the
   header from a cached tree.
