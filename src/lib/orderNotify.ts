import { getPublicStoreSettings } from "@/lib/storeSettings";

// price is optional: web/admin orders show it (confirmed prices), DTF orders
// omit it (the price is only an unconfirmed estimate until we finalize it).
export type OrderItemLine = { name: string; qty: number; price?: number };

type OrderNotifyInput = {
  subject: string;
  heading: string;
  lines: string[]; // "Label: value" display lines
  items?: OrderItemLine[]; // ordered items, shown as their own section
  adminPath: string; // e.g. "/web-orders" or "/dtf-orders"
};

type CustomerConfirmInput = {
  to: string;
  customerName: string;
  subject: string;
  heading: string;
  lines: string[]; // "Label: value" display lines (delivery address, payment method, etc.)
  items: OrderItemLine[];
  total?: number; // omit for DTF (estimate only) — shown when present
};

const BRAND_COLOR = "#F54927";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Splits "Label: value" into a [label, value] pair for the summary table;
// falls back to a single full-width cell if there's no colon.
function splitLine(line: string): [string, string] {
  const i = line.indexOf(":");
  if (i === -1) return ["", line];
  return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
}

function summaryRows(lines: string[]): string {
  return lines
    .map((line) => {
      const [label, value] = splitLine(line);
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#6b7280;font-size:14px;white-space:nowrap;padding-right:16px;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`;
    })
    .join("");
}

function money(n: number): string {
  return `Rs ${Number(n).toFixed(2)}`;
}

function itemRows(items: OrderItemLine[]): string {
  return items
    .map(
      (it) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#111827;font-size:14px;">${it.qty}× ${escapeHtml(it.name)}</td>
          ${
            it.price !== undefined
              ? `<td style="padding:8px 0;border-bottom:1px solid #eee;color:#111827;font-size:14px;text-align:right;white-space:nowrap;">${money(it.price)}</td>`
              : ""
          }
        </tr>`
    )
    .join("");
}

function emailShell(storeName: string, headerColor: string, bodyHtml: string, footerText: string): string {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="background:${headerColor};padding:20px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(storeName)}</span>
              </td>
            </tr>
            <tr><td style="padding:24px;">${bodyHtml}</td></tr>
            <tr>
              <td style="padding:16px 24px;background:#fafafa;border-top:1px solid #f0f0f0;">
                <span style="font-size:12px;color:#9ca3af;">${escapeHtml(footerText)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Owner alert — "New order" heading, item list, summary fields, admin link.
function buildOwnerEmailHtml(input: OrderNotifyInput, storeName: string, link: string): string {
  const itemsSection = input.items?.length
    ? `<h2 style="margin:20px 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Items</h2>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(input.items)}</table>`
    : "";
  const body = `
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${escapeHtml(input.heading)}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${summaryRows(input.lines)}</table>
    ${itemsSection}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr>
        <td style="border-radius:8px;background:${BRAND_COLOR};">
          <a href="${link}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">View in admin →</a>
        </td>
      </tr>
    </table>`;
  return emailShell(storeName, BRAND_COLOR, body, `${storeName} — automated order alert`);
}

// Customer confirmation — thank-you tone, item list + total, no admin link.
function buildCustomerEmailHtml(input: CustomerConfirmInput, storeName: string): string {
  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${escapeHtml(input.heading)}</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Hi ${escapeHtml(input.customerName)}, thanks for your order! Here's a summary:</p>
    <h2 style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Items</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(input.items)}</table>
    ${
      input.total !== undefined
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
             <tr>
               <td style="padding:10px 0 0;font-size:14px;font-weight:800;color:#111827;">Total</td>
               <td style="padding:10px 0 0;font-size:14px;font-weight:800;color:#111827;text-align:right;">${money(input.total)}</td>
             </tr>
           </table>`
        : ""
    }
    <h2 style="margin:20px 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Details</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${summaryRows(input.lines)}</table>
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">We'll be in touch shortly to confirm delivery. Thanks for shopping with us!</p>`;
  return emailShell(storeName, BRAND_COLOR, body, `${storeName} — order confirmation`);
}

async function resendSend(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[orderNotify] RESEND_API_KEY not set — skipping email");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error("[orderNotify] Resend API error", res.status, await res.text());
  }
}

// Fire-and-forget: awaited internally so the request actually completes before
// the serverless function returns, but every failure is caught and logged —
// never thrown — so a bad/missing API key, missing destination email, or a
// Resend outage can never break order creation.
export async function sendOrderNotification(input: OrderNotifyInput): Promise<void> {
  try {
    const settings = await getPublicStoreSettings();
    const to = settings.orderNotificationEmail;
    if (!to) {
      console.warn("[orderNotify] No order notification email configured — skipping");
      return;
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const link = siteUrl ? `${siteUrl}${input.adminPath}` : input.adminPath;
    const html = buildOwnerEmailHtml(input, settings.storeName || "Store", link);
    await resendSend(to, input.subject, html);
  } catch (err) {
    console.error("[orderNotify] failed to send", err);
  }
}

// Same fire-and-forget safety as sendOrderNotification. Only called when the
// customer actually provided an email — callers should check that first.
export async function sendCustomerOrderConfirmation(input: CustomerConfirmInput): Promise<void> {
  try {
    const settings = await getPublicStoreSettings();
    const html = buildCustomerEmailHtml(input, settings.storeName || "Store");
    await resendSend(input.to, input.subject, html);
  } catch (err) {
    console.error("[orderNotify] failed to send customer confirmation", err);
  }
}
