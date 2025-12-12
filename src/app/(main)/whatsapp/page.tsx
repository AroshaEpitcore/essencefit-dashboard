"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export default function WhatsAppChatPage() {
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Add to local state
    setMessages([...messages, { from: "me", text: input }]);

    // Call your backend WhatsApp API here
    await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });

    setInput("");
  };

  return (
    <div className="flex flex-col h-[80vh] bg-white dark:bg-gray-900 rounded-xl border p-4">
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg max-w-xs ${
              m.from === "me"
                ? "bg-green-500 text-white self-end ml-auto"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Send className="w-4 h-4" /> Send
        </button>
      </div>
    </div>
  );
}
