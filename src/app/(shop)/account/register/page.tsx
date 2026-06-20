"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { registerCustomer } from "../actions";

const input = "w-full bg-white border border-gray-300  px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function CustomerRegisterPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/account";
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await registerCustomer(f);
      toast.success("Account created!");
      router.push(next);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Toaster position="top-center" />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
      <p className="text-gray-500 mb-6 text-sm">Track your orders and check out faster.</p>
      <form onSubmit={submit} className="space-y-4">
        <input className={input} placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={input} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={input} placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input className={input} type="password" placeholder="Password (min 6 chars)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button disabled={busy} className="w-full bg-primary text-white py-3  font-semibold hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-5 text-center">
        Already have an account?{" "}
        <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="text-primary font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
