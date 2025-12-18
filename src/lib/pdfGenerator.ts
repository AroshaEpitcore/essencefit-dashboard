"use client";

export function generatePrintableHTML(data: any): string {
  const totalQty = data.items.reduce((sum: number, item: any) => sum + Number(item.qty), 0);
  const showFreeDelivery = totalQty >= 3;

  const itemsRows = data.items
    .map(
      (item: any) => `
      <tr>
        <td>
          <div class="item-name">${item.name}</div>
          ${item.variant ? `<div class="item-variant">${item.variant}</div>` : ""}
        </td>
        <td style="text-align: center;">${item.qty}</td>
        <td style="text-align: right;">Rs ${item.price}</td>
        <td style="text-align: right;"><strong>Rs ${item.amount}</strong></td>
      </tr>
    `
    )
    .join("");

  return `
  <div id="invoice-root">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #333; }
      .invoice-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e0e0e0; overflow: hidden; }
      .invoice-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; }
      .invoice-header h1 { font-size: 32px; margin-bottom: 8px; font-weight: 600; }
      .invoice-header .invoice-number { font-size: 14px; opacity: 0.9; letter-spacing: 1px; }
      .invoice-body { padding: 40px; }
      .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 2px solid #f0f0f0; }
      .info-box h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 12px; letter-spacing: 1px; font-weight: 600; }
      .info-box p { font-size: 15px; line-height: 1.6; color: #333; }
      .info-box p strong { display: block; font-size: 16px; margin-bottom: 4px; color: #667eea; }
      .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
      .items-table thead { background: #f8f9fa; }
      .items-table th { padding: 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #222; font-weight: 600; letter-spacing: 0.5px; border-bottom: 2px solid #e0e0e0; }
      .items-table th:last-child, .items-table td:last-child { text-align: right; }
      .items-table tbody tr { border-bottom: 1px solid #f0f0f0; }
      .items-table td { padding: 15px; font-size: 14px; color: #222; }
      .item-name { font-weight: 600; color: #222; }
      .item-variant { font-size: 12px; color: #555; margin-top: 4px; }
      .totals-section { display: flex; justify-content: flex-end; margin-top: 30px; }
      .totals-box { width: 350px; }
      .total-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 20px; font-weight: 700; color: #667eea; }
      .free-delivery-tag { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #d4edda; color: #155724; border-radius: 20px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px; }
      .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      .status-pending { background: #fff3cd; color: #856404; }
      .status-paid { background: #d4edda; color: #155724; }
      .status-partial { background: #d1ecf1; color: #0c5460; }
      .status-canceled { background: #f8d7da; color: #721c24; }
      .footer { text-align: center; padding: 30px; background: #f8f9fa; font-size: 13px; color: #666; line-height: 1.8; }
      .footer p { margin-bottom: 8px; }
    </style>

    <div class="invoice-container">
      <div class="invoice-header">
        <h1>INVOICE</h1>
        <div class="invoice-number">#${data.orderId}</div>
      </div>

      <div class="invoice-body">
        <div class="info-section">
          <div class="info-box">
            <h3>Bill To</h3>
            <p>
              <strong>${data.customer}</strong>
              ${data.phone ? `Phone: ${data.phone}<br>` : ""}
              ${data.address ? `${data.address}` : ""}
            </p>
          </div>

          <div class="info-box" style="text-align: right;">
            <h3>Invoice Details</h3>
            <p>
              <strong>Date</strong>
              ${data.date}<br>
              <strong style="margin-top: 12px;">Status</strong>
              <span class="status-badge status-${String(data.status).toLowerCase()}">${data.status}</span>
            </p>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>Rs ${data.subtotal}</span>
            </div>
            ${showFreeDelivery ? `
            <div style="display: flex; justify-content: flex-end;">
              <span class="free-delivery-tag">✓ FREE DELIVERY</span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="footer">
        <p><strong>Thank you for shopping with EssenceFit 💙</strong></p>
        <p>✨ Don't forget to confirm once you've received your order and share your feedback 🙌</p>
        <p>If you have any questions about this invoice, please contact us.</p>
      </div>
    </div>
  </div>
  `;
}

function createHiddenContainer(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;

  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.background = "white";
  container.style.pointerEvents = "none";
  container.style.zIndex = "999999";
  container.style.visibility = "hidden";

  document.body.appendChild(container);

  const element = container.querySelector("#invoice-root") as HTMLElement | null;
  if (!element) {
    container.remove();
    throw new Error("Invoice element not found");
  }

  return { container, element };
}

function sanitizeCustomerName(name: string) {
  return String(name || "customer")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

async function loadHtml2Pdf() {
  // dynamic import to avoid SSR issues
  const mod: any = await import("html2pdf.js");
  return mod?.default ?? mod;
}

export async function generatePDFBlob(data: any): Promise<Blob> {
  const htmlContent = generatePrintableHTML(data);
  const { container, element } = createHiddenContainer(htmlContent);

  try {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;

    container.style.visibility = "visible";
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const sanitizedCustomer = sanitizeCustomerName(data.customer);
    const html2pdf = await loadHtml2Pdf();

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `invoice_${sanitizedCustomer}_${data.orderId}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    } as const;

    // html2pdf returns a worker; output('blob') is the common way
    const worker = html2pdf().set(opt).from(element);
    const blob: Blob = await worker.output("blob");

    return blob;
  } finally {
    container.remove();
  }
}

export async function downloadPDF(data: any): Promise<void> {
  const htmlContent = generatePrintableHTML(data);
  const { container, element } = createHiddenContainer(htmlContent);

  try {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;

    container.style.visibility = "visible";
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const sanitizedCustomer = sanitizeCustomerName(data.customer);
    const html2pdf = await loadHtml2Pdf();

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `invoice_${sanitizedCustomer}_${data.orderId}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    } as const;

    await html2pdf().set(opt).from(element).save();
  } finally {
    container.remove();
  }
}