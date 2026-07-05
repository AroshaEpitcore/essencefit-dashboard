"use client";

import Link from "next/link";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { LabeledInput } from "@/components/shop/LabeledInput";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Please enter your email address.");
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      toast.error("Something went wrong — please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Toaster position="top-center" />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot your password?</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Enter the email on your account and we&apos;ll send you a link to reset it.
      </p>

      {sent ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-sm text-gray-700">
          <p className="font-semibold text-gray-900 mb-1">Check your inbox</p>
          <p>
            If an account exists for <b>{email.trim()}</b>, a reset link is on its way. The link
            works for 30 minutes — check your spam folder if you don&apos;t see it.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <LabeledInput
            id="forgot-email" label="Email address" type="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={busy} className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      <p className="text-sm text-gray-500 mt-5 text-center">
        Remembered it?{" "}
        <Link href="/account/login" className="text-primary font-medium hover:underline">Back to sign in</Link>
      </p>
      <p className="text-xs text-gray-400 mt-3 text-center">
        No email on your account? Message us on WhatsApp and we&apos;ll help you get back in.
      </p>
    </div>
  );
}
