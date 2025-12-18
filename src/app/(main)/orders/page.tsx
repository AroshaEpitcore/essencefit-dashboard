"use client";

import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { generateInvoicePDF, getWhatsAppMessage } from "./invoiceActions";
import { downloadPDF } from "@/lib/pdfGenerator";
import { getProductInfo } from "./actions";
import {
  getCategories,
  getProductsByCategory,
  getSizesByProduct,
  getColorsByProductAndSize,
  getVariant,
  getRecentOrders,
  getOrderDetails,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  type OrderItemInput,
  type OrderPayload,
  type OrderRange,
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
  Pencil,
  ChevronDown,
  ChevronUp,
  Phone,
  MapPin,
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

const ORDER_STATUSES = ["Pending", "Paid", "Partial", "Canceled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const RANGE_OPTIONS: Array<{ key: OrderRange; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "all", label: "All" },
];

const DELIVERY_OPTIONS = [300, 350, 400] as const;

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`inline-flex items-center gap-2 select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-primary" : "bg-gray-300 dark:bg-gray-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}

export default function OrdersPage() {
  const [categories, setCategories] = useState<Opt[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);
  const [sizes, setSizes] = useState<Opt[]>([]);
  const [colors, setColors] = useState<Opt[]>([]);

  const [selCat, setSelCat] = useState("");
  const [selProd, setSelProd] = useState("");
  const [selSize, setSelSize] = useState("");
  const [selColor, setSelColor] = useState("");

  const [lineQty, setLineQty] = useState<number>(1);
  const [linePrice, setLinePrice] = useState<number>(0);

  // create form
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<OrderStatus>("Pending");
  const [orderDate, setOrderDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [discount, setDiscount] = useState<number>(0);

  // ✅ delivery UI (CREATE)
  const [isFreeDelivery, setIsFreeDelivery] = useState(false);
  const [selectedDeliveryCharge, setSelectedDeliveryCharge] =
    useState<number>(300);

  const [lines, setLines] = useState<LineDraft[]>([]);

  // recent
  const [range, setRange] = useState<OrderRange>("today");
  const [recent, setRecent] = useState<any[]>([]);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, OrderStatus>>(
    {}
  );
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  // details
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, any[]>>({});

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);

  const [editCustomer, setEditCustomer] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editStatus, setEditStatus] = useState<OrderStatus>("Pending");
  const [editOrderDate, setEditOrderDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [editDiscount, setEditDiscount] = useState<number>(0);

  // ✅ delivery UI (EDIT)
  const [editIsFreeDelivery, setEditIsFreeDelivery] = useState(false);
  const [editSelectedDeliveryCharge, setEditSelectedDeliveryCharge] =
    useState<number>(300);

  const [editLines, setEditLines] = useState<LineDraft[]>([]);

  // edit pickers
  const [editProducts, setEditProducts] = useState<Opt[]>([]);
  const [editSizes, setEditSizes] = useState<Opt[]>([]);
  const [editColors, setEditColors] = useState<Opt[]>([]);
  const [editSelCat, setEditSelCat] = useState("");
  const [editSelProd, setEditSelProd] = useState("");
  const [editSelSize, setEditSelSize] = useState("");
  const [editSelColor, setEditSelColor] = useState("");
  const [editLineQty, setEditLineQty] = useState<number>(1);
  const [editLinePrice, setEditLinePrice] = useState<number>(0);

  const [editSelectedKey, setEditSelectedKey] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"add" | "replace">("add");

  useEffect(() => {
    (async () => {
      setCategories(await getCategories());
      await loadRecent();
    })();
  }, []);

  async function loadRecent() {
    const r = await getRecentOrders(100, range);
    setRecent(r);
    const draftMap: Record<string, OrderStatus> = {};
    r.forEach((o) => (draftMap[o.Id] = o.PaymentStatus as OrderStatus));
    setStatusDrafts(draftMap);
  }

  useEffect(() => {
    loadRecent();
  }, [range]);

  async function focusEditLine(line: LineDraft) {
    setEditSelectedKey(line.key);
    setEditMode("replace");

    const pid = line.productId;
    const sid = line.sizeId;
    const cid = line.colorId;
    if (!pid || !sid || !cid) return;

    const info = await getProductInfo(pid);
    if (!info?.CategoryId) return;

    setEditSelCat(info.CategoryId);
    const prods = await getProductsByCategory(info.CategoryId);
    setEditProducts(prods);
    setEditSelProd(pid);

    const szs = await getSizesByProduct(pid);
    setEditSizes(szs);
    setEditSelSize(sid);

    const cols = await getColorsByProductAndSize(pid, sid);
    setEditColors(cols);
    setEditSelColor(cid);

    setEditLineQty(line.qty);
    setEditLinePrice(line.price);
  }

  /* ---- cascading pickers (CREATE) ---- */
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
    setProducts(await getProductsByCategory(catId));
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
    setSizes(await getSizesByProduct(prodId));
  }

  async function onPickSize(sizeId: string) {
    setSelSize(sizeId);
    setSelColor("");
    setColors([]);
    setLineQty(1);
    setLinePrice(0);
    if (!selProd || !sizeId) return;
    setColors(await getColorsByProductAndSize(selProd, sizeId));
  }

  async function onPickColor(colorId: string) {
    setSelColor(colorId);
    setLineQty(1);
    if (selProd && selSize && colorId) {
      const v = await getVariant(selProd, selSize, colorId);
      if (!v) return toast.error("Variant not found.");
      setLinePrice(Number(v.SellingPrice) || 0);
    }
  }

  /* ---- cascading pickers (EDIT) ---- */
  async function onPickCategoryEdit(catId: string) {
    setEditSelCat(catId);
    setEditSelProd("");
    setEditProducts([]);
    setEditSelSize("");
    setEditSizes([]);
    setEditSelColor("");
    setEditColors([]);
    setEditLineQty(1);
    setEditLinePrice(0);
    setEditMode("add");
    setEditSelectedKey(null);
    if (!catId) return;
    setEditProducts(await getProductsByCategory(catId));
  }

  async function onPickProductEdit(prodId: string) {
    setEditSelProd(prodId);
    setEditSelSize("");
    setEditSizes([]);
    setEditSelColor("");
    setEditColors([]);
    setEditLineQty(1);
    setEditLinePrice(0);
    setEditMode("add");
    setEditSelectedKey(null);
    if (!prodId) return;
    setEditSizes(await getSizesByProduct(prodId));
  }

  async function onPickSizeEdit(sizeId: string) {
    setEditSelSize(sizeId);
    setEditSelColor("");
    setEditColors([]);
    setEditLineQty(1);
    setEditLinePrice(0);
    setEditMode("add");
    setEditSelectedKey(null);
    if (!editSelProd || !sizeId) return;
    setEditColors(await getColorsByProductAndSize(editSelProd, sizeId));
  }

  async function onPickColorEdit(colorId: string) {
    setEditSelColor(colorId);
    setEditLineQty(1);
    if (editSelProd && editSelSize && colorId) {
      const v = await getVariant(editSelProd, editSelSize, colorId);
      if (!v) return toast.error("Variant not found.");
      setEditLinePrice(Number(v.SellingPrice) || 0);
    }
  }

  async function addLine(target: "create" | "edit") {
    if (target === "create") {
      if (!selProd || !selSize || !selColor)
        return toast.error("Pick Product, Size, Color first.");
      const v = await getVariant(selProd, selSize, selColor);
      if (!v) return toast.error("Variant not found.");
      if (lineQty <= 0) return toast.error("Qty must be > 0");
      if (lineQty > v.InStock)
        return toast.error(`Only ${v.InStock} in stock for this variant.`);

      const row: LineDraft = {
        key: `${v.VariantId}-${Date.now()}`,
        productId: selProd,
        sizeId: selSize,
        colorId: selColor,
        variant: v,
        qty: lineQty,
        price: Number(linePrice || v.SellingPrice || 0),
      };

      setLines((p) => [...p, row]);
      setLineQty(1);
      return;
    }

    if (!editSelProd || !editSelSize || !editSelColor)
      return toast.error("Pick Product, Size, Color first.");
    const v = await getVariant(editSelProd, editSelSize, editSelColor);
    if (!v) return toast.error("Variant not found.");
    if (editLineQty <= 0) return toast.error("Qty must be > 0");
    if (editLineQty > v.InStock)
      return toast.error(`Only ${v.InStock} in stock for this variant.`);

    const row: LineDraft = {
      key: editSelectedKey ?? `${v.VariantId}-${Date.now()}`,
      productId: editSelProd,
      sizeId: editSelSize,
      colorId: editSelColor,
      variant: v,
      qty: editLineQty,
      price: Number(editLinePrice || v.SellingPrice || 0),
    };

    if (editMode === "replace" && editSelectedKey) {
      setEditLines((prev) =>
        prev.map((x) => (x.key === editSelectedKey ? row : x))
      );
      toast.success("Item updated");
    } else {
      setEditLines((prev) => [
        ...prev,
        { ...row, key: `${row.key}-${Date.now()}` },
      ]);
      toast.success("Item added");
    }

    setEditMode("add");
    setEditSelectedKey(null);
    setEditSelCat("");
    setEditSelProd("");
    setEditSelSize("");
    setEditSelColor("");
    setEditProducts([]);
    setEditSizes([]);
    setEditColors([]);
    setEditLineQty(1);
    setEditLinePrice(0);
  }

  function removeLine(target: "create" | "edit", key: string) {
    if (target === "create") setLines((p) => p.filter((l) => l.key !== key));
    else {
      setEditLines((p) => p.filter((l) => l.key !== key));
      if (editSelectedKey === key) {
        setEditSelectedKey(null);
        setEditMode("add");
      }
    }
  }

  function updateLineQty(target: "create" | "edit", key: string, qty: number) {
    const fn = (arr: LineDraft[]) =>
      arr.map((l) => (l.key === key ? { ...l, qty } : l));
    if (target === "create") setLines(fn);
    else setEditLines(fn);
  }

  function updateLinePrice(
    target: "create" | "edit",
    key: string,
    price: number
  ) {
    const fn = (arr: LineDraft[]) =>
      arr.map((l) => (l.key === key ? { ...l, price } : l));
    if (target === "create") setLines(fn);
    else setEditLines(fn);
  }

  // ✅ totals
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.price, 0),
    [lines]
  );

  const totalQty = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const eligibleFreeDelivery = totalQty >= 3;

  useEffect(() => {
    if (!eligibleFreeDelivery) setIsFreeDelivery(false);
  }, [eligibleFreeDelivery]);

  const deliverySaving = useMemo(() => {
    if (!eligibleFreeDelivery) return 0;
    return isFreeDelivery ? Number(selectedDeliveryCharge || 0) : 0;
  }, [eligibleFreeDelivery, isFreeDelivery, selectedDeliveryCharge]);

  const effectiveDeliveryFee = 0;

  const computedDiscount = useMemo(() => {
    return Number(discount || 0) + Number(deliverySaving || 0);
  }, [discount, deliverySaving]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - computedDiscount + effectiveDeliveryFee);
  }, [subtotal, computedDiscount]);

  // ✅ edit totals
  const editSubtotal = useMemo(
    () => editLines.reduce((s, l) => s + l.qty * l.price, 0),
    [editLines]
  );
  const editTotalQty = useMemo(
    () => editLines.reduce((s, l) => s + l.qty, 0),
    [editLines]
  );
  const editEligibleFreeDelivery = editTotalQty >= 3;

  useEffect(() => {
    if (!editEligibleFreeDelivery) setEditIsFreeDelivery(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEligibleFreeDelivery]);

  const editDeliverySaving = useMemo(() => {
    if (!editEligibleFreeDelivery) return 0;
    return editIsFreeDelivery ? Number(editSelectedDeliveryCharge || 0) : 0;
  }, [
    editEligibleFreeDelivery,
    editIsFreeDelivery,
    editSelectedDeliveryCharge,
  ]);

  // ✅ ALSO ALWAYS 0 in edit
  const editEffectiveDeliveryFee = 0;

  const editComputedDiscount = useMemo(() => {
    return Number(editDiscount || 0) + Number(editDeliverySaving || 0);
  }, [editDiscount, editDeliverySaving]);

  const editTotal = useMemo(() => {
    return Math.max(
      0,
      editSubtotal - editComputedDiscount + editEffectiveDeliveryFee
    );
  }, [editSubtotal, editComputedDiscount]);

  async function handleWhatsAppShare(orderId: string, customerPhone: string) {
    if (!customerPhone) {
      toast.error("No customer phone number");
      return;
    }

    const toastId = toast.loading("Preparing invoice...");

    try {
      // Get invoice data and WhatsApp message
      const [data, { message, phone }] = await Promise.all([
        generateInvoicePDF(orderId),
        getWhatsAppMessage(orderId),
      ]);

      // Clean phone number
      let cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "94" + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith("94")) {
        cleanPhone = "94" + cleanPhone;
      }

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

      // Note: PDF attachment not directly supported via web WhatsApp URL
      // User will need to manually attach the downloaded PDF
      toast.success(
        "Opening WhatsApp... PDF will download separately. Please attach it manually.",
        { id: toastId, duration: 5000 }
      );

      // Download PDF for user to attach
      await downloadPDF(data);

      // Open WhatsApp
      window.open(whatsappUrl, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Failed to prepare WhatsApp message", {
        id: toastId,
      });
    }
  }

  // ✅ UPDATED: PDF Download Button
  async function handlePDFDownload(orderId: string) {
    const toastId = toast.loading("Generating PDF...");

    try {
      const data = await generateInvoicePDF(orderId);
      await downloadPDF(data);
      toast.success("PDF downloaded successfully!", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF", { id: toastId });
    }
  }

  async function saveOrder() {
    if (!lines.length) return toast.error("No items in order");

    const payload: OrderPayload = {
      Customer: customer || null,
      CustomerPhone: customerPhone || null,
      Address: address || null,
      PaymentStatus: status,
      OrderDate: orderDate,
      Subtotal: Number(subtotal.toFixed(2)),
      Discount: Number(computedDiscount.toFixed(2)), // ✅ includes deliverySaving if toggle ON
      DeliveryFee: 0, // ✅ ALWAYS 0 as per your rule
      Total: Number(total.toFixed(2)),
      Items: lines.map<OrderItemInput>((l) => ({
        VariantId: l.variant!.VariantId,
        Qty: l.qty,
        SellingPrice: Number(l.price || 0),
      })),
    };

    try {
      await createOrder(payload);
      toast.success("Order saved");
      setLines([]);
      setCustomer("");
      setCustomerPhone("");
      setAddress("");
      setDiscount(0);
      setIsFreeDelivery(false);
      setSelectedDeliveryCharge(300);
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
          ord.Id === orderId ? { ...ord, PaymentStatus: nextStatus } : ord
        )
      );
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update status");
    } finally {
      setSavingStatus(null);
    }
  }

  async function toggleDetails(orderId: string) {
    setExpanded((p) => ({ ...p, [orderId]: !p[orderId] }));
    if (!details[orderId]) {
      try {
        const d = await getOrderDetails(orderId);
        setDetails((p) => ({ ...p, [orderId]: d.items }));
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load order details");
      }
    }
  }

  function resetEditPickers() {
    setEditSelCat("");
    setEditSelProd("");
    setEditSelSize("");
    setEditSelColor("");
    setEditProducts([]);
    setEditSizes([]);
    setEditColors([]);
    setEditLineQty(1);
    setEditLinePrice(0);
    setEditMode("add");
    setEditSelectedKey(null);
  }

  async function openEdit(orderId: string) {
    try {
      const d = await getOrderDetails(orderId);

      setEditOrderId(orderId);
      setEditCustomer(d.order.Customer ?? "");
      setEditCustomerPhone(d.order.CustomerPhone ?? "");
      setEditAddress(d.order.Address ?? "");
      setEditStatus(d.order.PaymentStatus as OrderStatus);
      setEditOrderDate(new Date(d.order.OrderDate).toISOString().slice(0, 10));

      // We cannot know selected charge from DB (no column)
      setEditSelectedDeliveryCharge(300);

      // If you saved a delivery-saving discount, user likely used free delivery toggle
      setEditIsFreeDelivery(Number(d.order.Discount ?? 0) > 0);

      setEditDiscount(Number(d.order.Discount ?? 0));

      const mapped: LineDraft[] = d.items.map((it: any) => ({
        key: `${it.VariantId}-${crypto.randomUUID()}`,
        productId: it.ProductId,
        sizeId: it.SizeId,
        colorId: it.ColorId,
        variant: {
          VariantId: it.VariantId,
          InStock: 999999,
          SellingPrice: Number(it.SellingPrice),
        },
        qty: Number(it.Qty),
        price: Number(it.SellingPrice),
      }));

      resetEditPickers();
      setEditLines(mapped);
      setEditOpen(true);

      if (mapped.length > 0) {
        await focusEditLine(mapped[0]);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to open edit");
    }
  }

  async function saveEdit() {
    if (!editOrderId) return;
    if (!editLines.length) return toast.error("No items in order");

    const payload: OrderPayload = {
      Customer: editCustomer || null,
      CustomerPhone: editCustomerPhone || null,
      Address: editAddress || null,
      PaymentStatus: editStatus,
      OrderDate: editOrderDate,
      Subtotal: Number(editSubtotal.toFixed(2)),
      Discount: Number(editComputedDiscount.toFixed(2)),
      DeliveryFee: 0, // ✅ ALWAYS 0
      Total: Number(editTotal.toFixed(2)),
      Items: editLines.map<OrderItemInput>((l) => ({
        VariantId: l.variant!.VariantId,
        Qty: l.qty,
        SellingPrice: Number(l.price || 0),
      })),
    };

    try {
      await updateOrder(editOrderId, payload);
      toast.success("Order updated");
      setEditOpen(false);
      setEditOrderId(null);
      await loadRecent();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update order");
    }
  }

  async function doDelete(orderId: string) {
    const ok = window.confirm(
      "Delete this order? This will also remove sales & restore stock."
    );
    if (!ok) return;

    try {
      await deleteOrder(orderId);
      toast.success("Order deleted");
      await loadRecent();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete order");
    }
  }

  function copySummary() {
    const s = [
      `Customer: ${customer}`,
      `Phone: ${customerPhone}`,
      `Address: ${address}`,
      `Date: ${orderDate}`,
      `Status: ${status}`,
      `Subtotal: Rs ${subtotal.toFixed(2)}`,
      `Discount: Rs ${computedDiscount.toFixed(2)}`,
      ...(isFreeDelivery && eligibleFreeDelivery
        ? [`Free Delivery Saving: Rs ${deliverySaving.toFixed(2)}`]
        : []),
      `Total: Rs ${total.toFixed(2)}`,
      `Items:`,
      ...lines.map(
        (l) =>
          ` - ${l.variant?.VariantId}  x${l.qty}  @Rs ${l.price.toFixed(2)}`
      ),
    ].join("\n");

    navigator.clipboard.writeText(s).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed")
    );
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-3 rounded-lg">
          <ShoppingBag className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Orders</h1>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as OrderRange)}
            className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            {RANGE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Create */}
      <section className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Create Order
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-2">Customer Name</label>
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
              placeholder="Customer"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Customer Phone</label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
              placeholder="07XXXXXXXX"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-2 flex items-center gap-1">
              <MapPin className="w-4 h-4" /> Address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
              placeholder="Delivery Address"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Order Date</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-2">Payment Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Add line */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={selCat}
            onChange={(e) => onPickCategory(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-4 py-3"
          >
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c.Id} value={c.Id}>
                {c.Name}
              </option>
            ))}
          </select>

          <select
            value={selProd}
            onChange={(e) => onPickProduct(e.target.value)}
            disabled={!selCat}
            className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-4 py-3 disabled:opacity-50"
          >
            <option value="">Product</option>
            {products.map((p) => (
              <option key={p.Id} value={p.Id}>
                {p.Name}
              </option>
            ))}
          </select>

          <select
            value={selSize}
            onChange={(e) => onPickSize(e.target.value)}
            disabled={!selProd}
            className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-4 py-3 disabled:opacity-50"
          >
            <option value="">Size</option>
            {sizes.map((s) => (
              <option key={s.Id} value={s.Id}>
                {s.Name}
              </option>
            ))}
          </select>

          <select
            value={selColor}
            onChange={(e) => onPickColor(e.target.value)}
            disabled={!selSize}
            className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-4 py-3 disabled:opacity-50"
          >
            <option value="">Color</option>
            {colors.map((c) => (
              <option key={c.Id} value={c.Id}>
                {c.Name}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            value={lineQty}
            onChange={(e) =>
              setLineQty(Math.max(1, parseInt(e.target.value || "1")))
            }
            className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-4 py-3"
            placeholder="Qty"
          />
          <input
            type="number"
            step="0.01"
            value={linePrice}
            onChange={(e) => setLinePrice(parseFloat(e.target.value || "0"))}
            className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-4 py-3"
            placeholder="Price"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => addLine("create")}
            className="bg-primary text-white px-5 py-3 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        {/* cart */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          {lines.length === 0 ? (
            <div className="text-sm text-gray-500">No items yet.</div>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <div
                  key={l.key}
                  className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                >
                  <div className="text-sm">
                    <div className="font-mono">{l.variant?.VariantId}</div>
                    <div className="text-xs text-gray-500">
                      Qty {l.qty} × Rs {l.price.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      className="w-20 text-center bg-white dark:bg-gray-800 border rounded-lg px-2 py-1"
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) =>
                        updateLineQty(
                          "create",
                          l.key,
                          Math.max(1, parseInt(e.target.value || "1"))
                        )
                      }
                    />
                    <input
                      className="w-28 text-center bg-white dark:bg-gray-800 border rounded-lg px-2 py-1"
                      type="number"
                      step="0.01"
                      value={l.price}
                      onChange={(e) =>
                        updateLinePrice(
                          "create",
                          l.key,
                          parseFloat(e.target.value || "0")
                        )
                      }
                    />
                    <button
                      onClick={() => removeLine("create", l.key)}
                      className="text-red-600 px-2 py-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* ✅ totals + free delivery UI */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                <div className="text-sm">
                  Subtotal: <b>Rs {subtotal.toFixed(2)}</b>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  Discount:
                  <input
                    className="w-24 bg-white dark:bg-gray-800 border rounded-lg px-2 py-1"
                    type="number"
                    step="0.01"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(parseFloat(e.target.value || "0"))
                    }
                  />
                </div>

                {eligibleFreeDelivery && (
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Total Qty:</span>
                      <b>{totalQty}</b>
                    </div>

                    <ToggleSwitch
                      checked={isFreeDelivery}
                      onChange={setIsFreeDelivery}
                      label="Free Delivery (Qty ≥ 3)"
                    />

                    {isFreeDelivery && (
                      <>
                        <div className="flex items-center gap-2">
                          <span>Charge:</span>
                          <select
                            value={selectedDeliveryCharge}
                            onChange={(e) =>
                              setSelectedDeliveryCharge(Number(e.target.value))
                            }
                            className="bg-white dark:bg-gray-800 border rounded-lg px-2 py-1"
                          >
                            {DELIVERY_OPTIONS.map((x) => (
                              <option key={x} value={x}>
                                Rs {x}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="text-xs text-green-600">
                          Saved Rs {deliverySaving.toFixed(2)}
                        </div>

                        <div className="text-xs">
                          Final Discount:{" "}
                          <b>Rs {computedDiscount.toFixed(2)}</b>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="text-sm">
                  Total: <b className="text-primary">Rs {total.toFixed(2)}</b>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={copySummary}
                  className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Clipboard className="w-4 h-4" /> Copy
                </button>
                <button
                  onClick={saveOrder}
                  className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save Order
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recent Orders */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Recent Orders
        </h2>

        {recent.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
            No orders.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recent.map((o) => (
              <motion.div
                key={o.Id}
                layout
                className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-lg">
                      {o.Customer || "Walk-in"}
                    </div>

                    {o.CustomerPhone && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {o.CustomerPhone}
                      </div>
                    )}

                    {o.Address && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {o.Address}
                      </div>
                    )}

                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(o.OrderDate).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Items: {o.LineCount}
                    </div>
                    <div className="text-sm font-bold text-primary mt-1">
                      Rs {Number(o.Total).toFixed(2)}
                    </div>
                  </div>

                  <span className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 dark:bg-gray-900/30">
                    {o.PaymentStatus}
                  </span>
                </div>

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

                {expanded[o.Id] && (
                  <div className="mt-3 text-sm space-y-2">
                    {(details[o.Id] || []).map((it: any) => (
                      <div
                        key={it.Id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="font-medium">{it.ProductName}</div>
                        <div className="text-xs text-gray-500">
                          {it.SizeName || "-"} / {it.ColorName || "-"}
                        </div>
                        <div className="text-xs font-mono text-gray-500">
                          Variant: {it.VariantId}
                        </div>
                        <div className="text-xs">
                          Qty: {it.Qty} × Rs{" "}
                          {Number(it.SellingPrice).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                  {/* Status Selector */}
                  <div>
                    <label className="text-xs text-gray-500">
                      Update Status
                    </label>
                    <select
                      value={statusDrafts[o.Id] ?? o.PaymentStatus}
                      onChange={(e) =>
                        setStatusDrafts((p) => ({
                          ...p,
                          [o.Id]: e.target.value as OrderStatus,
                        }))
                      }
                      className="mt-1 w-full bg-gray-50 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap justify-end gap-2">
                    {/* Save Status */}
                    <button
                      onClick={() => saveOrderStatus(o.Id)}
                      disabled={savingStatus === o.Id}
                      className="bg-primary disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {savingStatus === o.Id ? "Saving..." : "Save Status"}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEdit(o.Id)}
                      className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => doDelete(o.Id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>

                    {/* ✅ PDF Download */}
                    <button
                      onClick={() => handlePDFDownload(o.Id)}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>

                    {/* ✅ WhatsApp with PDF */}
                    <button
                      onClick={() => handleWhatsAppShare(o.Id, o.CustomerPhone)}
                      disabled={!o.CustomerPhone}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                      title={
                        !o.CustomerPhone
                          ? "No phone number"
                          : "Send invoice via WhatsApp"
                      }
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* EDIT MODAL */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-7xl bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-lg">Edit Order</div>
              <button
                onClick={() => setEditOpen(false)}
                className="text-sm px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
              <input
                value={editCustomer}
                onChange={(e) => setEditCustomer(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border rounded-lg px-3 py-2"
                placeholder="Customer"
              />
              <input
                value={editCustomerPhone}
                onChange={(e) => setEditCustomerPhone(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border rounded-lg px-3 py-2"
                placeholder="Phone"
              />
              <input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border rounded-lg px-3 py-2 md:col-span-2"
                placeholder="Address"
              />
              <input
                type="date"
                value={editOrderDate}
                onChange={(e) => setEditOrderDate(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                className="bg-gray-50 dark:bg-gray-800 border rounded-lg px-3 py-2"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* edit add/replace line */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <select
                value={editSelCat}
                onChange={(e) => onPickCategoryEdit(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-3 py-2"
              >
                <option value="">Category</option>
                {categories.map((c) => (
                  <option key={c.Id} value={c.Id}>
                    {c.Name}
                  </option>
                ))}
              </select>

              <select
                value={editSelProd}
                onChange={(e) => onPickProductEdit(e.target.value)}
                disabled={!editSelCat}
                className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-3 py-2 disabled:opacity-50"
              >
                <option value="">Product</option>
                {editProducts.map((p) => (
                  <option key={p.Id} value={p.Id}>
                    {p.Name}
                  </option>
                ))}
              </select>

              <select
                value={editSelSize}
                onChange={(e) => onPickSizeEdit(e.target.value)}
                disabled={!editSelProd}
                className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-3 py-2 disabled:opacity-50"
              >
                <option value="">Size</option>
                {editSizes.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name}
                  </option>
                ))}
              </select>

              <select
                value={editSelColor}
                onChange={(e) => onPickColorEdit(e.target.value)}
                disabled={!editSelSize}
                className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-3 py-2 disabled:opacity-50"
              >
                <option value="">Color</option>
                {editColors.map((c) => (
                  <option key={c.Id} value={c.Id}>
                    {c.Name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                value={editLineQty}
                onChange={(e) =>
                  setEditLineQty(Math.max(1, parseInt(e.target.value || "1")))
                }
                className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-3 py-2"
                placeholder="Qty"
              />
              <input
                type="number"
                step="0.01"
                value={editLinePrice}
                onChange={(e) =>
                  setEditLinePrice(parseFloat(e.target.value || "0"))
                }
                className="bg-gray-50 dark:bg-gray-800/50 border rounded-lg px-3 py-2"
                placeholder="Price"
              />
            </div>

            <div className="flex justify-end mb-4 gap-2">
              {editMode === "replace" && (
                <button
                  type="button"
                  onClick={() => {
                    resetEditPickers();
                    toast.success("Ready to add new item");
                  }}
                  className="bg-gray-200 dark:bg-gray-800 px-4 py-2 rounded-lg"
                >
                  New Item
                </button>
              )}

              <button
                onClick={() => addLine("edit")}
                className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {editMode === "replace" ? "Update Item" : "Add Item"}
              </button>
            </div>

            {/* ✅ edit totals + free delivery UI (TOGGLE) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="text-sm">
                Subtotal: <b>Rs {editSubtotal.toFixed(2)}</b>
              </div>

              <div className="flex items-center gap-2 text-sm">
                Discount:
                <input
                  className="w-24 bg-gray-50 dark:bg-gray-800 border rounded-lg px-2 py-1"
                  type="number"
                  step="0.01"
                  value={editDiscount}
                  onChange={(e) =>
                    setEditDiscount(parseFloat(e.target.value || "0"))
                  }
                />
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Total Qty:</span>
                  <b>{editTotalQty}</b>
                </div>

                <ToggleSwitch
                  checked={editIsFreeDelivery}
                  onChange={setEditIsFreeDelivery}
                  disabled={!editEligibleFreeDelivery}
                  label="Free Delivery (Qty ≥ 3)"
                />

                {editEligibleFreeDelivery && editIsFreeDelivery && (
                  <div className="flex items-center gap-2">
                    <span>Charge:</span>
                    <select
                      value={editSelectedDeliveryCharge}
                      onChange={(e) =>
                        setEditSelectedDeliveryCharge(Number(e.target.value))
                      }
                      className="bg-white dark:bg-gray-800 border rounded-lg px-2 py-1"
                    >
                      {DELIVERY_OPTIONS.map((x) => (
                        <option key={x} value={x}>
                          Rs {x}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editEligibleFreeDelivery && editIsFreeDelivery && (
                  <div className="text-xs text-green-600">
                    Saved Rs {editDeliverySaving.toFixed(2)}
                  </div>
                )}

                <div className="text-xs">
                  Final Discount: <b>Rs {editComputedDiscount.toFixed(2)}</b>
                </div>
              </div>

              <div className="text-sm">
                Total: <b className="text-primary">Rs {editTotal.toFixed(2)}</b>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              {editLines.map((l) => (
                <div
                  key={l.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => focusEditLine(l)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") focusEditLine(l);
                  }}
                  className={`w-full text-left flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${
                    editSelectedKey === l.key ? "ring-2 ring-primary" : ""
                  }`}
                  title="Click to load this item into the pickers"
                >
                  <div className="text-xs font-mono">
                    {l.variant?.VariantId}
                  </div>

                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      className="w-20 text-center bg-gray-50 dark:bg-gray-800 border rounded-lg px-2 py-1"
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) =>
                        updateLineQty(
                          "edit",
                          l.key,
                          Math.max(1, parseInt(e.target.value || "1"))
                        )
                      }
                    />
                    <input
                      className="w-28 text-center bg-gray-50 dark:bg-gray-800 border rounded-lg px-2 py-1"
                      type="number"
                      step="0.01"
                      value={l.price}
                      onChange={(e) =>
                        updateLinePrice(
                          "edit",
                          l.key,
                          parseFloat(e.target.value || "0")
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeLine("edit", l.key)}
                      className="text-red-600 px-2 py-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="bg-gray-200 dark:bg-gray-800 px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="bg-primary text-white px-4 py-2 rounded-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
