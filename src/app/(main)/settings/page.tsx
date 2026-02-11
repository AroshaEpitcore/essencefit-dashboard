"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getSettings, saveSetting } from "./actions";
import {
  Settings as SettingsIcon,
  Building2,
  Truck,
  FileText,
  Bell,
  Save,
  Phone,
  MapPin,
  Mail,
  CreditCard,
  Package,
  MessageCircle,
} from "lucide-react";
import { formatPhone, cleanPhoneInput } from "@/lib/phoneMask";

type SettingsMap = Record<string, string>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await getSettings();
      const map: SettingsMap = {};
      data.forEach((s: any) => {
        map[s.Key] = s.Value || "";
      });
      setSettings(map);
    } catch (err: any) {
      toast.error(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function updateSetting(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveAllSettings() {
    setSaving(true);
    try {
      const promises = Object.entries(settings).map(([key, value]) =>
        saveSetting(key, value || null)
      );
      await Promise.all(promises);
      toast.success("Settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveSection(keys: string[]) {
    setSaving(true);
    try {
      const promises = keys.map((key) =>
        saveSetting(key, settings[key] || null)
      );
      await Promise.all(promises);
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
        <button
          onClick={saveAllSettings}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Business Information */}
        <Section
          icon={<Building2 className="w-5 h-5" />}
          title="Business Information"
          description="Your business details for invoices and receipts"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Business Name"
              icon={<Building2 className="w-4 h-4" />}
              value={settings.business_name || ""}
              onChange={(v) => updateSetting("business_name", v)}
              placeholder="EssenceFit"
            />
            <InputField
              label="Phone Number"
              icon={<Phone className="w-4 h-4" />}
              value={formatPhone(settings.business_phone || "")}
              onChange={(v) => updateSetting("business_phone", cleanPhoneInput(v))}
              placeholder="0XX XXX XXXX"
            />
            <InputField
              label="Email"
              icon={<Mail className="w-4 h-4" />}
              value={settings.business_email || ""}
              onChange={(v) => updateSetting("business_email", v)}
              placeholder="info@essencefit.lk"
            />
            <InputField
              label="Address"
              icon={<MapPin className="w-4 h-4" />}
              value={settings.business_address || ""}
              onChange={(v) => updateSetting("business_address", v)}
              placeholder="Colombo, Sri Lanka"
            />
          </div>
          <SectionSaveButton
            onClick={() =>
              saveSection([
                "business_name",
                "business_phone",
                "business_email",
                "business_address",
              ])
            }
            saving={saving}
          />
        </Section>

        {/* Delivery Settings */}
        <Section
          icon={<Truck className="w-5 h-5" />}
          title="Delivery Settings"
          description="Delivery charges and free delivery rules"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField
              label="Colombo Delivery (Rs)"
              value={settings.delivery_colombo || "300"}
              onChange={(v) => updateSetting("delivery_colombo", v)}
              placeholder="300"
              type="number"
            />
            <InputField
              label="Outer Areas Delivery (Rs)"
              value={settings.delivery_outer || "350"}
              onChange={(v) => updateSetting("delivery_outer", v)}
              placeholder="350"
              type="number"
            />
            <InputField
              label="Eastern/Northern (Rs)"
              value={settings.delivery_far || "400"}
              onChange={(v) => updateSetting("delivery_far", v)}
              placeholder="400"
              type="number"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <InputField
              label="Free Delivery Min Qty"
              value={settings.free_delivery_qty || "3"}
              onChange={(v) => updateSetting("free_delivery_qty", v)}
              placeholder="3"
              type="number"
            />
            <InputField
              label="Low Stock Alert Threshold"
              icon={<Bell className="w-4 h-4" />}
              value={settings.low_stock_threshold || "5"}
              onChange={(v) => updateSetting("low_stock_threshold", v)}
              placeholder="5"
              type="number"
            />
          </div>
          <SectionSaveButton
            onClick={() =>
              saveSection([
                "delivery_colombo",
                "delivery_outer",
                "delivery_far",
                "free_delivery_qty",
                "low_stock_threshold",
              ])
            }
            saving={saving}
          />
        </Section>

        {/* Invoice Settings */}
        <Section
          icon={<FileText className="w-5 h-5" />}
          title="Invoice Settings"
          description="Customize your invoice appearance"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Invoice Prefix"
              value={settings.invoice_prefix || "INV-"}
              onChange={(v) => updateSetting("invoice_prefix", v)}
              placeholder="INV-"
            />
            <InputField
              label="Invoice Starting Number"
              value={settings.invoice_start_number || "1001"}
              onChange={(v) => updateSetting("invoice_start_number", v)}
              placeholder="1001"
              type="number"
            />
          </div>
          <div className="mt-4">
            <TextAreaField
              label="Invoice Footer Message"
              value={settings.invoice_footer || ""}
              onChange={(v) => updateSetting("invoice_footer", v)}
              placeholder="Thank you for your purchase! For inquiries, contact us at..."
              rows={3}
            />
          </div>
          <div className="mt-4">
            <TextAreaField
              label="Bank Details (for invoices)"
              icon={<CreditCard className="w-4 h-4" />}
              value={settings.bank_details || ""}
              onChange={(v) => updateSetting("bank_details", v)}
              placeholder="Bank: Commercial Bank&#10;Account: 1234567890&#10;Name: EssenceFit"
              rows={4}
            />
          </div>
          <SectionSaveButton
            onClick={() =>
              saveSection([
                "invoice_prefix",
                "invoice_start_number",
                "invoice_footer",
                "bank_details",
              ])
            }
            saving={saving}
          />
        </Section>

        {/* WhatsApp Settings */}
        <Section
          icon={<MessageCircle className="w-5 h-5" />}
          title="WhatsApp Message Templates"
          description="Default messages for WhatsApp sharing"
        >
          <div className="space-y-4">
            <TextAreaField
              label="Order Confirmation Message"
              value={settings.whatsapp_order_template || ""}
              onChange={(v) => updateSetting("whatsapp_order_template", v)}
              placeholder="Hi {customer}, your order #{order_id} has been confirmed! Total: Rs {total}"
              rows={4}
            />
            <TextAreaField
              label="Delivery Message"
              value={settings.whatsapp_delivery_template || ""}
              onChange={(v) => updateSetting("whatsapp_delivery_template", v)}
              placeholder="Hi {customer}, your order is out for delivery! Expected arrival: {eta}"
              rows={4}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Available placeholders: {"{customer}"}, {"{order_id}"}, {"{total}"}, {"{eta}"}, {"{address}"}
          </p>
          <SectionSaveButton
            onClick={() =>
              saveSection([
                "whatsapp_order_template",
                "whatsapp_delivery_template",
              ])
            }
            saving={saving}
          />
        </Section>

        {/* Order Settings */}
        <Section
          icon={<Package className="w-5 h-5" />}
          title="Order Settings"
          description="Default order behavior"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default Order Status</label>
              <select
                value={settings.default_order_status || "Pending"}
                onChange={(e) => updateSetting("default_order_status", e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Currency Symbol</label>
              <input
                value={settings.currency_symbol || "Rs"}
                onChange={(e) => updateSetting("currency_symbol", e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
                placeholder="Rs"
              />
            </div>
          </div>
          <SectionSaveButton
            onClick={() =>
              saveSection(["default_order_status", "currency_symbol"])
            }
            saving={saving}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="text-primary">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      {children}
    </div>
  );
}

function InputField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2 flex items-center gap-2">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3"
      />
    </div>
  );
}

function TextAreaField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2 flex items-center gap-2">
        {icon}
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 resize-none"
      />
    </div>
  );
}

function SectionSaveButton({
  onClick,
  saving,
}: {
  onClick: () => void;
  saving: boolean;
}) {
  return (
    <div className="mt-4 flex justify-end">
      <button
        onClick={onClick}
        disabled={saving}
        className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {saving ? "Saving..." : "Save Section"}
      </button>
    </div>
  );
}
