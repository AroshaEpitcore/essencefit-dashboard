---
date: 2026-06-23
slug: customer-auth-and-navbar-refresh
status: implementing
surfaces: [storefront]
research: workflow/research/2026-06-23-customer-auth-and-navbar-refresh.md
estimated_manual_effort: 1h 30m
---

# Storefront navbar login-state refresh — Implementation Plan

## Overview
Make the storefront navbar reflect the **current server session** instead of a one-time
client fetch, so it updates immediately after login / order placement / logout without a full
page reload — and align the account-page guards. (Option A: server-sourced state +
`router.refresh()`.)

## Estimated Manual Effort
**1h 30m** — human-in-the-loop time only (Claude Code implements): reviewing each phase's
diff and manually verifying the navbar/auth flows (login, place-order, logout, direct visits)
in the running app, plus the final `/validate`. Includes a 10% buffer.

## Current State
- `src/components/shop/AccountMenu.tsx:25-27` reads login via `getMyAccount()` in a
  mount-only `useEffect(() => …, [])`; `StoreHeader` lives in the persistent
  `src/app/(shop)/layout.tsx`, which is **not remounted** on client navigation, so the state
  goes stale after login/checkout.
- `src/app/(shop)/layout.tsx:25` renders `<StoreHeader settings={…} categories={…} />` —
  **no customer prop**; no server-rendered login state for `router.refresh()` to update.
- `createWebOrder` auto-signs the buyer in (`checkout/actions.ts:246-247`
  `setSessionCookie`), but `checkout/page.tsx` only `router.push`es — no header refresh.
- Server guards already correct: `/account`, `/account/orders`, `/order/[id]` redirect via
  `getCurrentCustomer()` (`account/page.tsx:23-25`, etc.); data accessors
  (`getMyAccount`/`getMyOrders`/`getMyOrder`) return null/`[]` without a session — **no data
  leak**. `/account/profile` (`account/profile/page.tsx:18-24`) guards **client-side** only.
- `src/lib/customerAuth.ts:49-62` `getCurrentCustomer()` returns `CustomerSession | null`
  (`{Id,Name,Email,Phone,Address}`), a plain serializable object.
- Gate: `npm run build` (`next build --turbopack`).

## Desired End State
- Logged in → navbar shows the customer's **initials + dropdown**; logged out → the person
  icon. The navbar updates **without a manual reload** after: placing an order while logged
  out (auto-sign-in), logging in/registering, and logging out.
- `/account/profile` redirects server-side like the other account pages.
- `npm run build` green.

## What We're NOT Doing
- Not introducing a client `AuthContext` (Option B) — rejected in favor of server-sourced state.
- Not changing the session mechanism, cookie, or the SQL ownership scoping (already correct).
- Not touching the admin app or the data layer (just-finished Supabase migration).
- Not adding the account control to extra surfaces beyond the existing desktop navbar +
  mobile drawer (mobile drawer link stays as-is).

## Touchpoints (storefront only)
- **Layout (server)**: `src/app/(shop)/layout.tsx` — fetch `getCurrentCustomer()`, pass `customer` down.
- **Navbar (client)**: `src/components/shop/StoreHeader.tsx` (accept + forward `customer`),
  `src/components/shop/AccountMenu.tsx` (render from prop, drop mount fetch).
- **Auth-change refresh (client)**: `src/app/(shop)/checkout/page.tsx`,
  `src/app/(auth)/login` + register and/or `src/app/(shop)/account/login` (whichever the
  storefront login uses — confirm at implementation).
- **Profile guard**: `src/app/(shop)/account/profile/page.tsx` (+ a small client form child).
- **Tenancy note**: n/a (single-tenant storefront; no CompanyKey).

---

## Phase 1: Server-source the navbar login state
### Changes
#### `src/app/(shop)/layout.tsx` — fetch the customer, pass it down
```tsx
import { getCurrentCustomer } from "@/lib/customerAuth";
// inside the async layout:
const customer = await getCurrentCustomer(); // {Id,Name,Email,Phone} | null
// ...
<StoreHeader settings={settings} categories={categories} customer={customer} />
```
(Reading `cookies()` here makes the `(shop)` layout dynamic; acceptable — it already fetches
store settings/categories.)

#### `src/components/shop/StoreHeader.tsx` — accept + forward `customer`
Add `customer` to props and pass to `<AccountMenu customer={customer} iconCls={iconCls} />`.

#### `src/components/shop/AccountMenu.tsx` — render from prop, not a mount fetch
```tsx
type Me = { Name: string; Phone: string | null; Email: string | null } | null;
export default function AccountMenu({ customer, iconCls }: { customer: Me; iconCls: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // ...outside-click effect stays...
  async function logout() { await logoutCustomer(); setOpen(false); router.refresh(); }
  if (!customer) return <Link href="/account" className={iconCls} aria-label="Account"><User .../></Link>;
  // ...initials button + dropdown render from `customer` directly (no getMyAccount, no `me` state)...
}
```
Remove the `getMyAccount` import/`useEffect`/`me` state; `customer` now comes from the server
via props, so `router.refresh()` is the single update path.

### Success Criteria
#### Automated
- [x] `npm run build` is green.
- [x] `grep -n "getMyAccount" src/components/shop/AccountMenu.tsx` returns nothing.
#### Manual
- [ ] Logged out: navbar shows the person icon. Logged in (refresh once): shows initials + working dropdown (account / orders / log out).
- [ ] Click **Log out** in the dropdown → navbar reverts to the icon without a full reload.

**Pause here** for manual confirmation.

---

## Phase 2: Refresh the navbar on auth changes + align the profile guard
### Changes
#### `src/app/(shop)/checkout/page.tsx` — refresh after a successful order
After `createWebOrder(...)` resolves (which may have auto-signed-in), call `router.refresh()`
so the persistent header re-renders with the new session, then `router.push('/order/${id}?placed=1')`.

#### Storefront login/register — refresh after sign-in
In the customer login (and register) success handler, add `router.refresh()` alongside the
existing `router.push(next)` so the navbar updates immediately. (Confirm the exact file at
implementation — `src/app/(shop)/account/login` or `src/app/(auth)/login`.)

#### `src/app/(shop)/account/profile/page.tsx` — server-side guard
Split into a server page that redirects when not signed in, rendering a client form child:
```tsx
// page.tsx (server)
const me = await getCurrentCustomer();
if (!me) redirect("/account/login?next=/account/profile");
return <ProfileForm initial={{ name: me.Name, phone: me.Phone ?? "", address: me.Address ?? "" }} />;
```
Move the existing form into `ProfileForm.tsx` (`"use client"`), seeded by `initial` (drops the
client-side `getMyAccount` redirect dance).

### Success Criteria
#### Automated
- [x] `npm run build` is green.
#### Manual
- [ ] While **logged out**, place an order (with a password) → on the order page the navbar
  **immediately** shows your initials (no manual reload).
- [ ] Log in from `/account/login` → navbar shows initials right away; log out → reverts.
- [ ] Visit `/account/profile` while logged out → redirected to login (server-side, no spinner flash).

**Pause here** for final manual confirmation, then `/validate customer-auth-and-navbar-refresh`.

## Testing Strategy
No automated suite covers the storefront; verification is the manual flow checks above against
the running dev app (`npm run dev`) with a real customer session. The gate is `npm run build`.

## References
- Research: `workflow/research/2026-06-23-customer-auth-and-navbar-refresh.md`
- Patterns to follow: existing server guards `src/app/(shop)/account/page.tsx:23-25`;
  logout-then-`router.refresh()` already in `AccountMenu`/`LogoutButton`.
- Industry standard considered: Next.js App Router auth-state in a persistent layout is
  idiomatically server-read (`cookies()`) + `router.refresh()` to propagate post-action,
  rather than a mount-only client fetch (Next.js docs: "Server Actions → Revalidating data" /
  `router.refresh()`). This plan follows that standard; the client-context alternative
  (Option B) was considered and rejected to avoid a client/server source-of-truth split.
