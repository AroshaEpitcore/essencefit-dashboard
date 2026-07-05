"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { LabeledInput } from "@/components/shop/LabeledInput";
import { loginCustomer } from "../actions";

export default function CustomerLoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/account";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await loginCustomer({ identifier, password });
      if (!res.ok) {
        toast.error(res.error);
        setBusy(false);
        return;
      }
      toast.success("Welcome back!");
      router.push(next);
      router.refresh();
    } catch {
      toast.error("Login failed — please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Toaster position="top-center" />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h1>
      <p className="text-gray-500 mb-6 text-sm">Access your orders and faster checkout.</p>
      <form onSubmit={submit} className="space-y-4">
        <LabeledInput
          id="login-identifier" label="Email or phone"
          value={identifier} onChange={(e) => setIdentifier(e.target.value)}
        />
        <LabeledInput
          id="login-password" label="Password" type="password"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-right -mt-2">
          <Link href="/account/forgot" className="text-sm text-primary font-medium hover:underline">
            Forgot password?
          </Link>
        </div>
        <button disabled={busy} className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-5 text-center">
        No account?{" "}
        <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="text-primary font-medium hover:underline">Create one</Link>
      </p>
    </div>
  );
}
