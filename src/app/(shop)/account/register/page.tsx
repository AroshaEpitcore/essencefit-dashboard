"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { LabeledInput } from "@/components/shop/LabeledInput";
import { formatPhone, cleanPhoneInput } from "@/lib/phoneMask";
import { registerCustomer } from "../actions";

function RegisterForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/account";
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await registerCustomer(f);
      if (!res.ok) {
        toast.error(res.error);
        setBusy(false);
        return;
      }
      toast.success("Account created!");
      router.push(next);
      router.refresh();
    } catch {
      toast.error("Registration failed — please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Toaster position="top-center" />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
      <p className="text-gray-500 mb-6 text-sm">Track your orders and check out faster.</p>
      <form onSubmit={submit} className="space-y-4">
        <LabeledInput
          id="register-name" label="Full name"
          value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <LabeledInput
          id="register-email" label="Email" type="email"
          value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <LabeledInput
          id="register-phone" label="Phone" type="tel" inputMode="numeric"
          value={formatPhone(f.phone)} onChange={(e) => setF({ ...f, phone: cleanPhoneInput(e.target.value) })}
        />
        <LabeledInput
          id="register-password" label="Password (min 6 chars)" type="password"
          value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
        />
        <button disabled={busy} className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
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

/* useSearchParams needs a Suspense boundary now that the (shop) layout
   is static (it no longer reads cookies, enabling home-page ISR). */
export default function CustomerRegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
