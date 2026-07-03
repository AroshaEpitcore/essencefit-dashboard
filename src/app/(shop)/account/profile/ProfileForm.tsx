"use client";

import Link from "next/link";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { ChevronLeft, User, Lock } from "lucide-react";
import { FloatingInput, FloatingTextarea } from "@/components/shop/FloatingInput";
import PhoneInput from "@/components/shop/PhoneInput";
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
        <FloatingInput
          id="profile-name" label="Name" leftAdornment={<User className="w-4 h-4 text-gray-400" />}
          value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <PhoneInput id="profile-phone" label="Phone" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
        <FloatingTextarea
          id="profile-address" label="Address" rows={3}
          value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })}
        />
        <FloatingInput
          id="profile-password" label="New password (optional)" type="password"
          leftAdornment={<Lock className="w-4 h-4 text-gray-400" />}
          value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
        />
        <button disabled={busy} className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">{busy ? "Saving..." : "Save changes"}</button>
      </form>
    </div>
  );
}
