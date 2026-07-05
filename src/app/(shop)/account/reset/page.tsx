"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { LabeledInput } from "@/components/shop/LabeledInput";
import { resetPassword } from "../actions";

export default function ResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirm) return toast.error("Passwords don't match.");
    setBusy(true);
    try {
      const res = await resetPassword({ token, password });
      if (!res.ok) {
        toast.error(res.error);
        setBusy(false);
        return;
      }
      toast.success("Password updated — you're signed in!");
      router.push("/account");
      router.refresh();
    } catch {
      toast.error("Could not reset password — please try again.");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid reset link</h1>
        <p className="text-gray-500 text-sm mb-6">This link is missing its token — please use the link from your email.</p>
        <Link href="/account/forgot" className="text-primary font-medium hover:underline">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Toaster position="top-center" />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Choose a new password</h1>
      <p className="text-gray-500 mb-6 text-sm">You&apos;ll be signed in right after.</p>
      <form onSubmit={submit} className="space-y-4">
        <LabeledInput
          id="reset-password" label="New password (min 6 characters)" type="password"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        <LabeledInput
          id="reset-confirm" label="Confirm new password" type="password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
        />
        <button disabled={busy} className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Updating..." : "Update password"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-5 text-center">
        Link expired?{" "}
        <Link href="/account/forgot" className="text-primary font-medium hover:underline">Request a new one</Link>
      </p>
    </div>
  );
}
