"use client";

import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { generateInvoice, sendInvoiceWhatsApp } from "./invoiceActions";
import {
  getCategories,
  getProductsByCategory,
  getSizesByProduct,
  getColorsByProductAndSize,
  getVariant,
  getRecentOrders,
  createOrder,
  updateOrderStatus, // NEW
  type OrderItemInput,
  type OrderPayload,
} from "./actions";
import {
  ShoppingBag,
  Plus,
  Trash2,
  Clipboard,
  CheckCircle2,
  User,
  Calendar,
  FileText,
} from "lucide-react";

type Opt = { Id: string; Name: string };

type LineDraft = {
  key: string;
  productId?: string;
  sizeId?: string;
  colorId?: string;
  variant?: { VariantId: string; InStock: number; SellingPrice: number };
  qty: number;
  price: number;
};

// allowed statuses
const ORDER_STATUSES = ["Pending", "Paid", "Partial", "Canceled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

export default function OrdersPage() {
  // lookups
  const [categories, setCategories] = useState<Opt[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);
  const [sizes, setSizes] = useState<Opt[]>([]);
  const [colors, setColors] = useState<Opt[]>([]);

  // pickers
  const [selCat, setSelCat] = useState("");
  const [selProd, setSelProd] = useState("");
  const [selSize, setSelSize] = useState("");
  const [selColor, setSelColor] = useState("");

  const [lineQty, setLineQty] = useState<number>(1);
  const [linePrice, setLinePrice] = useState<number>(0);

  // order details
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<OrderStatus>("Pending");
  const [orderDate, setOrderDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [discount, setDiscount] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [note, setNote] = useState("");

  // cart + recent
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  // per-card editable status drafts
  // { [orderId]: "Paid" | "Pending" | etc. }
  const [statusDrafts, setStatusDrafts] = useState<Record<string, OrderStatus>>(
    {}
  );
  const [savingStatus, setSavingStatus] = useState<string | null>(null); // orderId being saved

  useEffect(() => {
    (async () => {
      const cats = await getCategories();
      setCategories(cats);
      await loadRecent();
    })();
  }, []);

  async function loadRecent() {
    const r = await getRecentOrders(12);
    setRecent(r);
    // initialize drafts from actual status
    const draftMap: Record<string, OrderStatus> = {};
    r.forEach((o) => {
      draftMap[o.Id] = o.PaymentStatus as OrderStatus;
    });
    setStatusDrafts(draftMap);
  }

  /* ---- cascading pickers ---- */
  async function onPickCategory(catId: string) {
    setSelCat(catId);
    setSelProd("");
    setProducts([]);
    setSelSize("");
    setSizes([]);
    setSelColor("");
    setColors([]);
    setLineQty(1);
    setLinePrice(0);

    if (!catId) return;
    const prods = await getProductsByCategory(catId);
    setProducts(prods);
  }

  async function onPickProduct(prodId: string) {
    setSelProd(prodId);
    setSelSize("");
    setSizes([]);
    setSelColor("");
    setColors([]);
    setLineQty(1);
    setLinePrice(0);

    if (!prodId) return;
    const s = await getSizesByProduct(prodId);
    setSizes(s);
  }

  async function onPickSize(sizeId: string) {
    setSelSize(sizeId);
    setSelColor("");
    setColors([]);
    setLineQty(1);
    setLinePrice(0);

    if (!selProd || !sizeId) return;
    const c = await getColorsByProductAndSize(selProd, sizeId);
    setColors(c);
  }

  async function onPickColor(colorId: string) {
    setSelColor(colorId);
    setLineQty(1);
    if (selProd && selSize && colorId) {
      const v = await getVariant(selProd, selSize, colorId);
      if (!v) {
        toast.error("Variant not found.");
        return;
      }
      setLinePrice(Number(v.SellingPrice) || 0);
    }
  }

  async function addLine() {
    if (!selProd || !selSize || !selColor) {
      toast.error("Pick Product, Size, Color first.");
      return;
    }
    const v = await getVariant(selProd, selSize, selColor);
    if (!v) {
      toast.error("Variant not found.");
      return;
    }
    if (lineQty <= 0) {
      toast.error("Qty must be > 0");
      return;
    }
    if (lineQty > v.InStock) {
      toast.error(`Only ${v.InStock} in stock for this variant.`);
      return;
    }

    const key = `${v.VariantId}-${Date.now()}`;
    setLines((prev) => [
      ...prev,
      {
        key,
        productId: selProd,
        sizeId: selSize,
        colorId: selColor,
        variant: v,
        qty: lineQty,
        price: Number(linePrice || v.SellingPrice || 0),
      },
    ]);
    setLineQty(1);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLineQty(key: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty } : l))
    );
  }

  function updateLinePrice(key: string, price: number) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, price } : l))
    );
  }

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.price, 0),
    [lines]
  );
  const total = useMemo(
    () => Math.max(0, subtotal - (discount || 0) + (deliveryFee || 0)),
    [subtotal, discount, deliveryFee]
  );

  async function saveOrder() {
    if (!lines.length) {
      toast.error("No items in order");
      return;
    }
    for (const l of lines) {
      if (!l.variant) {
        toast.error("Variant missing.");
        return;
      }
      if (l.qty <= 0) {
        toast.error("Qty must be > 0");
        return;
      }
      if (l.qty > l.variant.InStock) {
        toast.error("One line exceeds available stock.");
        return;
      }
    }

    const payload: OrderPayload = {
      Customer: customer || null,
      Phone: phone || null,
      Address: address || null,
      PaymentStatus: status,
      OrderDate: orderDate,
      Subtotal: Number(subtotal.toFixed(2)),
      Discount: Number((discount || 0).toFixed(2)),
      DeliveryFee: Number((deliveryFee || 0).toFixed(2)),
      Total: Number(total.toFixed(2)),
      Note: note || null,
      Items: lines.map<OrderItemInput>((l) => ({
        VariantId: l.variant!.VariantId,
        Qty: l.qty,
        SellingPrice: Number(l.price || 0),
      })),
    };

    try {
      await createOrder(payload);
      toast.success("Order saved");

      // reset form/cart
      setLines([]);
      setCustomer("");
      setPhone("");
      setAddress("");
      setDiscount(0);
      setDeliveryFee(0);
      setNote("");

      await loadRecent();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save order");
    }
  }

  async function saveOrderStatus(orderId: string) {
    const nextStatus = statusDrafts[orderId];
    if (!nextStatus) return;

    try {
      setSavingStatus(orderId);
      await updateOrderStatus(orderId, nextStatus);
      toast.success("Status updated");

      setRecent((prev) =>
        prev.map((ord) =>
          ord.Id === orderId
            ? { ...ord, PaymentStatus: nextStatus }
            : ord
        )
      );
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update status");
    } finally {
      setSavingStatus(null);
    }
  }

  function copySummary() {
    const s = [
      `Customer: ${customer}`,
      `Phone: ${phone}`,
      `Date: ${orderDate}`,
      `Status: ${status}`,
      `Subtotal: Rs ${subtotal.toFixed(2)}`,
      `Discount: Rs ${Number(discount || 0).toFixed(2)}`,
      `Delivery: Rs ${Number(deliveryFee || 0).toFixed(2)}`,
      `Total: Rs ${total.toFixed(2)}`,
      `Items:`,
      ...lines.map(
        (l) =>
          ` - ${l.variant?.VariantId}  x${l.qty}  @Rs ${l.price.toFixed(2)}`
      ),
      note ? `Note: ${note}` : "",
    ].join("\n");
    navigator.clipboard.writeText(s).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed")
    );
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/20 p-3 rounded-lg">
          <ShoppingBag className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Orders</h1>
      </div>

      {/* Customer + Order meta */}
      <section className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Customer Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer Name
            </label>
            <input
              placeholder="Enter customer name"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone
            </label>
            <input
              placeholder="Enter phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Address
            </label>
            <input
              placeholder="Enter address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Order Date
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Note (Optional)
            </label>
            <input
              placeholder="Add a note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>
      </section>

      {/* Add line */}
      <section className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Add Line Item
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={selCat}
              onChange={(e) => onPickCategory(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">Select</option>
              {categories.map((c) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>
          </div>

          {/* Product */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product
            </label>
            <select
              value={selProd}
              onChange={(e) => onPickProduct(e.target.value)}
              disabled={!selCat}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
            >
              <option value="">Select</option>
              {products.map((p) => (
                <option key={p.Id} value={p.Id}>
                  {p.Name}
                </option>
              ))}
            </select>
          </div>

          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Size
            </label>
            <select
              value={selSize}
              onChange={(e) => onPickSize(e.target.value)}
              disabled={!selProd}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
            >
              <option value="">Select</option>
              {sizes.map((s) => (
                <option key={s.Id} value={s.Id}>
                  {s.Name}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <select
              value={selColor}
              onChange={(e) => onPickColor(e.target.value)}
              disabled={!selSize}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
            >
              <option value="">Select</option>
              {colors.map((c) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>
          </div>

          {/* Qty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={lineQty}
              onChange={(e) =>
                setLineQty(Math.max(1, parseInt(e.target.value || "1")))
              }
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Qty"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Price (Rs)
            </label>
            <input
              type="number"
              step="0.01"
              value={linePrice}
              onChange={(e) => setLinePrice(parseFloat(e.target.value || "0"))}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Price"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={addLine}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </section>

      {/* Cart lines */}
      <section className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Order Items
          </h2>
        </div>

        {lines.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No items yet. Add items from above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">
                    Variant
                  </th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">
                    In Stock
                  </th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">
                    Price (Rs)
                  </th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">
                    Qty
                  </th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">
                    Total (Rs)
                  </th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {lines.map((l) => (
                  <tr
                    key={l.key}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="p-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Variant ID
                      </div>
                      <div className="font-mono text-sm">
                        {l.variant?.VariantId}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      {l.variant?.InStock ?? 0}
                    </td>

                    <td className="p-4 text-center">
                      <input
                        type="number"
                        step="0.01"
                        value={l.price}
                        onChange={(e) =>
                          updateLinePrice(
                            l.key,
                            parseFloat(e.target.value || "0")
                          )
                        }
                        className="w-24 text-center bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1"
                      />
                    </td>

                    <td className="p-4 text-center">
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) =>
                          updateLineQty(
                            l.key,
                            Math.max(1, parseInt(e.target.value || "1"))
                          )
                        }
                        className="w-20 text-center bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1"
                      />
                    </td>

                    <td className="p-4 text-center font-semibold">
                      {(l.qty * l.price).toFixed(2)}
                    </td>

                    <td className="p-4 text-center">
                      <button
                        onClick={() => removeLine(l.key)}
                        className="text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="bg-gray-50 dark:bg-gray-700/30">
                <tr>
                  <td colSpan={6} className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6 items-end justify-between">
                      {/* totals */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div className="text-gray-600 dark:text-gray-300">
                          Subtotal:
                        </div>
                        <div className="text-center font-semibold">
                          Rs {subtotal.toFixed(2)}
                        </div>

                        <div className="text-gray-600 dark:text-gray-300">
                          Discount:
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={discount}
                          onChange={(e) =>
                            setDiscount(parseFloat(e.target.value || "0"))
                          }
                          className="w-32 text-center bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5"
                        />

                        <div className="text-gray-600 dark:text-gray-300">
                          Delivery Fee:
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={deliveryFee}
                          onChange={(e) =>
                            setDeliveryFee(parseFloat(e.target.value || "0"))
                          }
                          className="w-32 text-center bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5"
                        />

                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          Total:
                        </div>
                        <div className="text-center text-xl font-bold text-primary">
                          Rs {total.toFixed(2)}
                        </div>
                      </div>

                      {/* buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={copySummary}
                          className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-5 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors"
                        >
                          <Clipboard className="w-4 h-4" /> Copy
                        </button>

                        <button
                          onClick={saveOrder}
                          className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors"
                        >
                          <CheckCircle2 className="w-5 h-5" /> Save Order
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Recent orders */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Recent Orders
        </h2>

        {recent.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No orders yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recent.map((o) => (
              <motion.div
                key={o.Id}
                layout
                className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-lg">
                      {o.Customer || "Walk-in"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(o.OrderDate).toLocaleString()}
                    </div>
                    {o.Phone && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        📞 {o.Phone}
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      o.PaymentStatus === "Paid"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : o.PaymentStatus === "Pending"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : o.PaymentStatus === "Partial"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {o.PaymentStatus}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Items
                    </span>
                    <span className="font-medium">{o.LineCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total
                    </span>
                    <span className="font-bold text-primary">
                      Rs {o.Total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* inline status edit */}
                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col gap-3">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Update Status
                    </label>
                    <select
                      value={statusDrafts[o.Id] ?? o.PaymentStatus}
                      onChange={(e) =>
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [o.Id]: e.target.value as OrderStatus,
                        }))
                      }
                      className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 flex-wrap">
                    <button
                      onClick={async () => {
                        await saveOrderStatus(o.Id);
                      }}
                      disabled={savingStatus === o.Id}
                      className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      {savingStatus === o.Id ? (
                        <span className="animate-pulse">Saving…</span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Save Status
                        </>
                      )}
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          const res = await generateInvoice(o.Id);
                          toast.success("Invoice generated");
                          window.open(res, "_blank");
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-3 py-2 rounded-lg text-sm font-medium"
                    >
                      <FileText className="w-4 h-4 inline-block mr-1" />
                      Invoice
                    </button>

                    <button
                      onClick={async () => {
                        if (!o.Phone) {
                          toast.error("No phone number for this order");
                          return;
                        }
                        try {
                          await sendInvoiceWhatsApp(o.Id, o.Phone);
                          toast.success("Sent via WhatsApp");
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium"
                    >
                      Send WhatsApp
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
