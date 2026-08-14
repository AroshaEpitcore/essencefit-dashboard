// Force every /account/* route to render per-request instead of being
// statically prerendered. The auth pages (login/register/forgot/reset) carry
// no cacheable content, and a long-lived static edge-cache entry can outlive a
// deploy — pairing stale prerendered HTML with the new deploy's JS chunks,
// which hydrates as a React mismatch (#310 "more hooks", #418 "text mismatch")
// and shows the "client-side exception" screen. Rendering dynamically means the
// HTML always comes from the current deployment, so it can never go stale.
// (The signed-in pages here already read the session and were dynamic anyway.)
export const dynamic = "force-dynamic";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
