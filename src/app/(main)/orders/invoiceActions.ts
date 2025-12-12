"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fetch from "node-fetch";

/* 🔹 Generate Invoice PDF */
export async function generateInvoice(orderId: string) {
  const db = await getDb();

  // --- Fetch order header & lines ---
  const orderRes = await db
    .request()
    .input("Id", sql.UniqueIdentifier, orderId)
    .query(`
      SELECT o.Id, o.Customer, o.Phone, o.Address, o.OrderDate, 
             o.Subtotal, o.Discount, o.DeliveryFee, o.Total, o.PaymentStatus
      FROM Orders o WHERE o.Id=@Id
    `);
  const order = orderRes.recordset[0];
  if (!order) throw new Error("Order not found");

  const linesRes = await db
    .request()
    .input("OrderId", sql.UniqueIdentifier, orderId)
    .query(`
      SELECT p.Name AS ProductName, s.Name AS Size, c.Name AS Color,
             i.Qty, i.SellingPrice
      FROM OrderItems i
      JOIN ProductVariants v ON i.VariantId = v.Id
      JOIN Products p ON v.ProductId = p.Id
      JOIN Sizes s ON v.SizeId = s.Id
      JOIN Colors c ON v.ColorId = c.Id
      WHERE i.OrderId=@OrderId
    `);
  const items = linesRes.recordset;

  // --- Create PDF ---
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 60;

  // --- Logo ---
  const logoUrl =
    "https://essencefits.com/wp-content/uploads/2025/06/cropped-cropped-cropped-logo-black-130x63.png";
  try {
    const logoImgBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
    const logoImg = await pdfDoc.embedPng(logoImgBytes);
    const logoDims = logoImg.scale(0.7);
    page.drawImage(logoImg, {
      x: 40,
      y: y - 40,
      width: logoDims.width,
      height: logoDims.height,
    });
  } catch {
    // ignore logo errors
  }

  // --- Header ---
  page.drawText("INVOICE", {
    x: width - 150,
    y: y - 10,
    size: 22,
    font: bold,
    color: rgb(0, 0, 0),
  });

  y -= 70;
  page.drawText("Essence Fit", { x: 40, y, size: 12, font: bold });
  y -= 15;
  page.drawText("No. 123, Colombo, Sri Lanka", { x: 40, y, size: 10, font });
  y -= 12;
  page.drawText("Email: support@essencefits.com", { x: 40, y, size: 10, font });

  // --- Order Info ---
  y -= 30;
  page.drawText(`Invoice ID: ${order.Id}`, { x: 40, y, size: 10, font });
  page.drawText(`Date: ${new Date(order.OrderDate).toLocaleDateString()}`, {
    x: width - 200,
    y,
    size: 10,
    font,
  });

  // --- Customer Info ---
  y -= 40;
  page.drawText("Bill To:", { x: 40, y, size: 12, font: bold });
  y -= 15;
  page.drawText(`${order.Customer || "Walk-in Customer"}`, {
    x: 40,
    y,
    size: 10,
    font,
  });
  y -= 12;
  if (order.Phone) page.drawText(`📞 ${order.Phone}`, { x: 40, y, size: 10, font });
  if (order.Address) {
    y -= 12;
    page.drawText(`${order.Address}`, { x: 40, y, size: 10, font });
  }

  // --- Items Table ---
  y -= 40;
  page.drawText("Item", { x: 40, y, size: 11, font: bold });
  page.drawText("Qty", { x: 270, y, size: 11, font: bold });
  page.drawText("Price", { x: 330, y, size: 11, font: bold });
  page.drawText("Total", { x: 410, y, size: 11, font: bold });

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 60, y }, thickness: 1 });

  for (const item of items) {
    y -= 20;
    page.drawText(
      `${item.ProductName} (${item.Size} / ${item.Color})`,
      { x: 40, y, size: 10, font }
    );
    page.drawText(`${item.Qty}`, { x: 280, y, size: 10, font });
    page.drawText(`Rs ${item.SellingPrice.toFixed(2)}`, { x: 330, y, size: 10, font });
    page.drawText(
      `Rs ${(item.Qty * item.SellingPrice).toFixed(2)}`,
      { x: 410, y, size: 10, font }
    );
  }

  // --- Summary ---
  y -= 40;
  const drawRow = (label: string, value: string, isBold = false) => {
    const f = isBold ? bold : font;
    page.drawText(label, { x: 330, y, size: 10, font: f });
    page.drawText(value, { x: 450, y, size: 10, font: f });
    y -= 15;
  };

  drawRow("Subtotal:", `Rs ${order.Subtotal.toFixed(2)}`);
  drawRow("Discount:", `Rs ${order.Discount.toFixed(2)}`);
  drawRow("Delivery:", `Rs ${order.DeliveryFee.toFixed(2)}`);
  drawRow("Total:", `Rs ${order.Total.toFixed(2)}`, true);

  // --- Footer ---
  y -= 40;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 60, y }, thickness: 0.5 });
  y -= 20;
  page.drawText("Thank you for shopping with Essence Fit 💪", {
    x: 160,
    y,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // --- Save PDF ---
  const bytes = await pdfDoc.save();
  const outDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, `invoice-${orderId}.pdf`);
  fs.writeFileSync(filePath, bytes);

  return `/invoice-${orderId}.pdf`;
}

/* 🔹 Send via WhatsApp (using wa.me link) */
export async function sendInvoiceWhatsApp(orderId: string, phone: string) {
  const link = `https://essencefits.com/invoice-${orderId}.pdf`;
  const msg = `Hi! Here's your Essence Fit invoice 🧾: ${link}`;
  if (!phone) throw new Error("Customer phone number missing.");
  const clean = phone.replace(/[^0-9]/g, "");
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  return url;
}
