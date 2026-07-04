"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";

/* Simple message composer for the /contact page: the visitor types a name and
   message and we open WhatsApp with it prefilled — no backend inbox needed,
   since the store handles everything through WhatsApp anyway. */
export default function ContactWhatsAppForm({ waLink }: { waLink: string }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `Hi! I'm ${name.trim() || "a customer"}.\n${message.trim()}`;
    window.open(`${waLink}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const input =
    "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors";

  return (
    <form onSubmit={send} className="space-y-3.5">
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
        <input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kasun"
          className={input}
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          placeholder="Ask about sizes, custom DTF prints, your order — anything."
          className={`${input} resize-none`}
        />
      </div>
      <button
        type="submit"
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-white text-sm font-semibold px-6 py-3 hover:bg-primary/90 transition-colors"
      >
        <Send className="w-4 h-4" /> Send via WhatsApp
      </button>
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <MessageCircle className="w-3.5 h-3.5" /> Opens WhatsApp with your message ready to send — we usually reply within the day.
      </p>
    </form>
  );
}
