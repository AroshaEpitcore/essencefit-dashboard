/* Build a wa.me deep link from a phone number as typed in Store Settings.
   Sri Lankan numbers with a leading 0 become +94; anything else is used as-is. */
export function waHref(phone?: string | null): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? "94" + digits.slice(1) : digits}`;
}
