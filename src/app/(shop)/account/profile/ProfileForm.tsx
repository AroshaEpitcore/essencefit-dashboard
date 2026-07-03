"use client";

import Link from "next/link";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { ChevronLeft } from "lucide-react";
import { LabeledInput, LabeledTextarea } from "@/components/shop/LabeledInput";
import { cleanPhoneInput } from "@/lib/phoneMask";
import { updateMyProfile } from "../actions";

export default function ProfileForm({ initial }: { initial: { name: string; phone: string; address: string } }) {
  const [f, setF] = useState({ ...initial, password: "" });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateMyProfile(f);
      toast.success("Profile updated");
      setF((p) => ({ ...p, password: "" }));
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Toaster position="top-center" />
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to account
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
      <form onSubmit={save} className="space-y-4">
        <LabeledInput
          id="profile-name" label="Name"
          value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <LabeledInput
          id="profile-phone" label="Phone" type="tel" inputMode="numeric" maxLength={10}
          value={f.phone} onChange={(e) => setF({ ...f, phone: cleanPhoneInput(e.target.value) })}
        />
        <LabeledTextarea
          id="profile-address" label="Address" rows={3}
          value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })}
        />
        <LabeledInput
          id="profile-password" label="New password (optional)" type="password"
          value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
        />
        <button disabled={busy} className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">{busy ? "Saving..." : "Save changes"}</button>
      </form>
    </div>
  );
}
