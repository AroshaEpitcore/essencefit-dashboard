"use client";

import Link from "next/link";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { ChevronLeft } from "lucide-react";
import { updateMyProfile } from "../actions";

const input = "w-full bg-white border border-gray-300  px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40";

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
        <div><label className="block text-sm font-medium text-gray-600 mb-1">Name</label><input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="block text-sm font-medium text-gray-600 mb-1">Phone</label><input className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="block text-sm font-medium text-gray-600 mb-1">Address</label><textarea rows={3} className={`${input} resize-none`} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><label className="block text-sm font-medium text-gray-600 mb-1">New password</label><input type="password" className={input} placeholder="Leave blank to keep current" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button disabled={busy} className="w-full bg-primary text-white py-3  font-semibold hover:bg-primary/90 disabled:opacity-50">{busy ? "Saving..." : "Save changes"}</button>
      </form>
    </div>
  );
}
