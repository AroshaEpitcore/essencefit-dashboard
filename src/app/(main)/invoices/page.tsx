"use client";

import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import {
  getRecentOrders,
  getOrderDetails,
  type OrderRange,
} from "../orders/actions";
import { generateInvoicePDF } from "../orders/invoiceActions";
import {
  FileText,
  Download,
  Search,
  X,
  Phone,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Truck,
} from "lucide-react";
import { formatPhone } from "@/lib/phoneMask";

const DELIVERY_OPTIONS = [300, 350, 400] as const;

/* ---- Invoice PDF generation (self-contained, no external pdfGenerator dependency) ---- */

function generateInvoiceHTML(data: any, deliveryCharge: number): string {
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

  const subtotal = parseFloat(data.subtotal || "0");
  const totalQty = data.items.reduce((sum: number, item: any) => sum + Number(item.qty), 0);
  const isFreeDelivery = totalQty >= 3;
  const deliveryFee = isFreeDelivery ? 0 : deliveryCharge;
  const total = subtotal + deliveryFee;

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
      .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; color: #333; }
      .total-row.grand { padding: 12px 0; font-size: 20px; font-weight: 700; color: #667eea; border-top: 2px solid #e0e0e0; margin-top: 8px; }
      .total-row.delivery { color: #e67e22; }
      .free-delivery-tag { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #d4edda; color: #155724; border-radius: 20px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px; }
      .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      .status-pending { background: #fff3cd; color: #856404; }
      .status-paid { background: #d4edda; color: #155724; }
      .status-partial { background: #d1ecf1; color: #0c5460; }
      .status-completed { background: #d4edda; color: #155724; }
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
              <span>Rs ${subtotal.toFixed(2)}</span>
            </div>
            ${isFreeDelivery ? `
            <div style="display: flex; justify-content: flex-end;">
              <span class="free-delivery-tag">✓ FREE DELIVERY</span>
            </div>
            ` : `
            ${deliveryFee > 0 ? `
            <div class="total-row delivery">
              <span>Delivery Charge:</span>
              <span>Rs ${deliveryFee.toFixed(2)}</span>
            </div>
            ` : ""}
            <div class="total-row grand">
              <span>Total:</span>
              <span>Rs ${total.toFixed(2)}</span>
            </div>
            `}
          </div>
        </div>
      </div>

      <div class="footer">
        <p><strong>Thank you for shopping with EssenceFit</strong></p>
        <p>If you have any questions about this invoice, please contact us.</p>
      </div>
    </div>
  </div>
  `;
}

function sanitizeCustomerName(name: string) {
  return String(name || "customer")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

async function downloadInvoicePDF(data: any, deliveryCharge: number): Promise<void> {
  const htmlContent = generateInvoiceHTML(data, deliveryCharge);

  const container = document.createElement("div");
  container.innerHTML = htmlContent;
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

  try {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;

    container.style.visibility = "visible";
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const sanitized = sanitizeCustomerName(data.customer);
    const mod: any = await import("html2pdf.js");
    const html2pdf = mod?.default ?? mod;

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `invoice_${sanitized}_${data.orderId}.pdf`,
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

const RANGE_OPTIONS: Array<{ key: OrderRange; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "all", label: "All" },
];

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Partial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function InvoicesPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [range, setRange] = useState<OrderRange>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // delivery charge selections per order (only for < 3 pcs)
  const [deliveryCharges, setDeliveryCharges] = useState<Record<string, number>>({});
  const [deliveryEnabled, setDeliveryEnabled] = useState<Record<string, boolean>>({});

  // expanded details
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, any>>({});

  // downloading state
  const [downloading, setDownloading] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    let list = searchQuery.trim() ? allOrders : orders;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((o) => {
        const customer = (o.Customer || "").toLowerCase();
        const phone = (o.CustomerPhone || "").toLowerCase();
        const address = (o.Address || "").toLowerCase();
        const orderId = (o.Id || "").toLowerCase();
        return (
          customer.includes(q) ||
          phone.includes(q) ||
          address.includes(q) ||
          orderId.includes(q)
        );
      });
    }

    if (statusFilter !== "all") {
      list = list.filter((o) => o.PaymentStatus === statusFilter);
    }

    return list;
  }, [orders, allOrders, searchQuery, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [range]);

  async function loadOrders() {
    setLoading(true);
    try {
      const r = await getRecentOrders(100, range);
      setOrders(r);
      const all = await getRecentOrders(1000, "all");
      setAllOrders(all);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function toggleDetails(orderId: string) {
    setExpanded((p) => ({ ...p, [orderId]: !p[orderId] }));
    if (!details[orderId]) {
      try {
        const d = await getOrderDetails(orderId);
        setDetails((p) => ({ ...p, [orderId]: d }));
      } catch (e: any) {
        toast.error(e?.message || "Failed to load details");
      }
    }
  }

  function getOrderTotalQty(order: any): number {
    return Number(order.LineCount || 0);
  }

  function isDeliveryChargeEligible(order: any): boolean {
    return getOrderTotalQty(order) < 3;
  }

  async function handleDownload(order: any) {
    const toastId = toast.loading("Generating invoice PDF...");
    setDownloading(order.Id);

    try {
      const data = await generateInvoicePDF(order.Id);

      const hasDelivery = deliveryEnabled[order.Id] && isDeliveryChargeEligible(order);
      const charge = hasDelivery ? (deliveryCharges[order.Id] || 300) : 0;

      await downloadInvoicePDF(data, charge);
      toast.success("Invoice downloaded!", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate invoice", { id: toastId });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold whitespace-nowrap">Invoices</h1>
        </div>

        {/* Search */}
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer, phone, address, or order ID..."
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Found{" "}
                <span className="font-medium text-primary">
                  {filteredOrders.length}
                </span>{" "}
                order{filteredOrders.length !== 1 ? "s" : ""}
                <span className="ml-1">(searching from all orders)</span>
              </p>
            )}
          </div>
        </div>

        {/* Range Filter */}
        <div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as OrderRange)}
            className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-5 py-3 text-sm"
          >
            {RANGE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <span className="text-sm text-gray-500 mr-2">Filter by status:</span>
        {["all", "Pending", "Paid", "Partial", "Completed", "Canceled"].map(
          (st) => {
            const base = searchQuery.trim() ? allOrders : orders;
            const count =
              st === "all"
                ? base.length
                : base.filter((o) => o.PaymentStatus === st).length;

            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === st
                    ? "bg-primary text-white shadow-md"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {st === "all" ? "All" : st}
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    statusFilter === st
                      ? "bg-white/20"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* Orders List */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Orders ({filteredOrders.length})
        </h2>

        {loading ? (
          <div className="text-center py-10 text-gray-500 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
            {searchQuery ? "No orders match your search." : "No orders found."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOrders.map((o) => {
              const totalQty = Number(o.LineCount || 0);
              const isFreeDelivery = totalQty >= 3;
              const eligible = isDeliveryChargeEligible(o);
              const hasDelivery = deliveryEnabled[o.Id] && eligible;
              const charge = deliveryCharges[o.Id] || 300;
              const displayTotal = hasDelivery
                ? Number(o.Subtotal) + charge
                : Number(o.Subtotal);

              return (
                <motion.div
                  key={o.Id}
                  layout
                  className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
                >
                  {/* Order header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-lg truncate">
                        {o.Customer || "Walk-in"}
                      </div>
                      {o.CustomerPhone && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 flex-shrink-0" /> {formatPhone(o.CustomerPhone)}
                        </div>
                      )}
                      {o.Address && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{o.Address}</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(o.OrderDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Items: {o.LineCount} pcs
                      </div>
                    </div>

                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${
                        STATUS_COLORS[o.PaymentStatus] || "bg-gray-100 dark:bg-gray-900/30"
                      }`}
                    >
                      {o.PaymentStatus}
                    </span>
                  </div>

                  {/* Totals */}
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">
                        Subtotal: Rs {Number(o.Subtotal).toFixed(2)}
                      </div>
                      {isFreeDelivery && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
                            <Truck className="w-3 h-3" /> FREE DELIVERY
                          </span>
                        </div>
                      )}
                      {hasDelivery && (
                        <div className="text-xs text-orange-600 mt-1">
                          Delivery: +Rs {charge.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="text-lg font-bold text-primary">
                      Rs {displayTotal.toFixed(2)}
                    </div>
                  </div>

                  {/* Delivery Charge Option (only for < 3 pcs) */}
                  {eligible && (
                    <div className="mt-3 border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                          Delivery Charge (Less than 3 pcs)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!deliveryEnabled[o.Id]}
                            onChange={(e) =>
                              setDeliveryEnabled((p) => ({
                                ...p,
                                [o.Id]: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm">Add delivery</span>
                        </label>

                        {deliveryEnabled[o.Id] && (
                          <select
                            value={charge}
                            onChange={(e) =>
                              setDeliveryCharges((p) => ({
                                ...p,
                                [o.Id]: Number(e.target.value),
                              }))
                            }
                            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                          >
                            {DELIVERY_OPTIONS.map((x) => (
                              <option key={x} value={x}>
                                Rs {x}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Details toggle */}
                  <button
                    onClick={() => toggleDetails(o.Id)}
                    className="mt-3 w-full text-sm bg-gray-100 dark:bg-gray-900/30 hover:bg-gray-200 dark:hover:bg-gray-900/50 rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span>Order Details</span>
                    {expanded[o.Id] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {expanded[o.Id] && details[o.Id] && (
                    <div className="mt-3 text-sm space-y-2">
                      {(details[o.Id].items || []).map((it: any) => (
                        <div
                          key={it.Id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                        >
                          <div className="font-medium">{it.ProductName}</div>
                          <div className="text-xs text-gray-500">
                            {it.SizeName || "-"} / {it.ColorName || "-"}
                          </div>
                          <div className="text-xs">
                            Qty: {it.Qty} x Rs {Number(it.SellingPrice).toFixed(2)} ={" "}
                            <b>Rs {(it.Qty * Number(it.SellingPrice)).toFixed(2)}</b>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Download Button */}
                  <button
                    onClick={() => handleDownload(o)}
                    disabled={downloading === o.Id}
                    className="mt-4 w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    {downloading === o.Id
                      ? "Generating..."
                      : `Download Invoice${hasDelivery ? ` (+ Rs ${charge})` : ""}`}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
