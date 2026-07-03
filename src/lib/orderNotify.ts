import { getPublicStoreSettings } from "@/lib/storeSettings";

type OrderNotifyInput = {
  subject: string;
  heading: string;
  lines: string[]; // "Label: value" display lines
  adminPath: string; // e.g. "/web-orders" or "/dtf-orders"
};

const BRAND_COLOR = "#F54927";

function escapeHtml(s: string): string {
  return s
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

// Simple, table-based, inline-styled layout — the only markup that renders
// consistently across Gmail/Outlook/Apple Mail without a stylesheet.
function buildEmailHtml(input: OrderNotifyInput, storeName: string, link: string): string {
  const rows = input.lines
    .map((line) => {
      const [label, value] = splitLine(line);
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#6b7280;font-size:14px;white-space:nowrap;padding-right:16px;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="background:${BRAND_COLOR};padding:20px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(storeName)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${escapeHtml(input.heading)}</h1>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                  <tr>
                    <td style="border-radius:8px;background:${BRAND_COLOR};">
                      <a href="${link}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">View in admin →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#fafafa;border-top:1px solid #f0f0f0;">
                <span style="font-size:12px;color:#9ca3af;">${escapeHtml(storeName)} — automated order alert</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Fire-and-forget: awaited internally so the request actually completes before
// the serverless function returns, but every failure is caught and logged —
// never thrown — so a bad/missing API key, missing destination email, or a
// Resend outage can never break order creation.
export async function sendOrderNotification(input: OrderNotifyInput): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[orderNotify] RESEND_API_KEY not set — skipping email");
      return;
    }
    const settings = await getPublicStoreSettings();
    const to = settings.orderNotificationEmail;
    if (!to) {
      console.warn("[orderNotify] No order notification email configured — skipping");
      return;
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const link = siteUrl ? `${siteUrl}${input.adminPath}` : input.adminPath;
    const html = buildEmailHtml(input, settings.storeName || "Store", link);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: [to],
        subject: input.subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[orderNotify] Resend API error", res.status, await res.text());
    }
  } catch (err) {
    console.error("[orderNotify] failed to send", err);
  }
}
