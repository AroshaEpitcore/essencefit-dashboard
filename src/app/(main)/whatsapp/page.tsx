"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  MessageCircle,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Search,
  X,
  Save,
  Image,
} from "lucide-react";

type Message = {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
};

const CATEGORIES = [
  "Order Confirmation",
  "Payment Reminder",
  "Delivery Update",
  "Follow Up",
  "Product Info",
  "Custom",
];

export default function WhatsAppMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formImageUrl, setFormImageUrl] = useState("");

  // Load messages from storage on mount
  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    try {
      // Load default messages for EssenceFit
      const defaultMessages: Message[] = [
        {
          id: "1",
          title: "Welcome Message with Size Chart",
          content: `Thank you so much for choosing EssenceFit 🙌 
Dry-fit unisex shorts 900/-
Dry Fit Calvin Klein Active wear T Shirts 1500/-
⭕ 3ක් ගත්තොත් ගෙදරටම free delivery ගෙන්නගන්න පුලුවන්
🤸Gym එකට,ගෙදරට, 🧳Travel  කරන්න වගේ ඕනම  තැනකට  අඳින්න පුලුවන්
ඉලාස්ටික් වේස්ට් එක තියෙන නිස  ඇදෙනවා, ගැටගහගන්න පුළුවන් නුලකුත් තියෙනවා ඒ නිසා හරිම comfortable 
ඔයාලට අපෙන් ඕඩර් එක ප්ලේස් කරගන්න ඕන නම් ඔයාගේ 
➡️ නම
➡️ඇඩ්‍රස් එක 
➡️ෆෝන් නම්බර් එක  
➡️ඔයාලට ඕන ෂෝට්වල  සයිස් එක මට එවන්න.
 ඔයාලට දවස් දෙක තුනක් ඇතුළත අපි ඔයාලගේ ඕඩර් එක ගෙදරටම එවනවා ✅

---

Thank you so much for choosing EssenceFit 🙌 
Dry-fit unisex shorts Rs. 900/-
Dry Fit Calvin Klein Active wear T-Shirts Rs. 1500/-
⭕ Buy 3 items and get FREE home delivery!
🤸 Perfect for the gym, home, 🧳 travel, or anywhere you want to wear them
Features elastic waist that stretches, drawstring for adjustment, and pockets - super comfortable!
To place your order with us, please send me:
➡️ Your Name
➡️ Your Address
➡️ Phone Number
➡️ Sizes you want for the shorts
We'll deliver your order to your doorstep within 2-3 days ✅`,
          category: "Product Info",
          imageUrl:
            "https://i.postimg.cc/Fz9zYvcd/Whats-App-Image-2025-08-19-at-08-42-10-087e633a.jpg",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "2",
          title: "Order Details Request",
          content: `📦✨ To arrange your order, could you please share:
1️⃣ Full Name
2️⃣ Delivery Address
3️⃣ Contact Number
This will help us process your order smoothly 🙌`,
          category: "Order Confirmation",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "3",
          title: "Delivery & Product Info",
          content: `📦 Delivery Charges
Colombo Area → Rs. 300
Outer Areas → Rs. 350
Eastern & Northern Province → Rs. 400

Our shorts are made with Dry-Fit, Stretchable fabric — perfect for gym, sports, travel, or everyday wear. Breathable, quick-dry & super comfortable ✅
Each short is Rs. 900 ✅ but we have an ongoing offer: Buy 3 & get FREE delivery 🚚
Perfect for gym, sports, travel, or everyday wear. Breathable, quick-dry & super comfortable ✅

Before placing your order, feel free to check our customer reviews and see why people love EssenceFit 💪👖
👉 https://www.facebook.com/profile.php?id=61575738370531&sk=reviews
Quality, comfort & fast delivery 🚚✨`,
          category: "Product Info",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "4",
          title: "Order Follow Up",
          content: `ඔයා මේ බැලුව order එක දානවද සර් ?
⭕ශොර්ට්ස් 3ක් ගත්තම Free Delivery  හම්බෙන Offer එකක් තියෙනවා....
⭕ඔර්ඩර් එකක් දාගන්න ඕන ?
මට තව විස්තර ලබාගන්න ඕන ♻
ඔව්ව් දානවා ❇
නෑ එපා 🚫

---

Are you interested in placing this order, sir?
⭕ We have an ongoing offer: Buy 3 shorts and get Free Delivery!
⭕ Would you like to place an order?
I need more information ♻
Yes, I'll place an order ❇
No, thank you 🚫

---

நீங்கள் இந்த ஆர்டரை செய்ய விரும்புகிறீர்களா சார்?
⭕ 3 ஷார்ட்ஸ் வாங்கினால் இலவச டெலிவரி கிடைக்கும்!
⭕ ஆர்டர் செய்ய விரும்புகிறீர்களா?
எனக்கு மேலும் விவரங்கள் தேவை ♻
ஆம், ஆர்டர் செய்கிறேன் ❇
வேண்டாம், நன்றி 🚫`,
          category: "Follow Up",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "5",
          title: "Review Request",
          content: `We hope you're enjoying your EssenceFit purchase! 🌟
When you have a moment, we'd be truly grateful if you could leave us a quick review on Facebook. Your feedback helps us grow and serve you better.
👉 Leave a Review Here - https://www.facebook.com/share/18hqCpoGiZ/
Thank you so much for your support! 🙏`,
          category: "Follow Up",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "6",
          title: "Size & Color Inquiry",
          content: `Size Kohomada sir / miss ?
Then I can send you the colors for your size

---

How about the size, sir/miss?
Then I can send you the colors for your size

---

சைஸ் எப்படி சார் / மிஸ்?
பின்னர் உங்கள் சைஸுக்கான வண்ணங்களை அனுப்புகிறேன்`,
          category: "Product Info",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setMessages(defaultMessages);
      localStorage.setItem(
        "whatsapp_messages",
        JSON.stringify(defaultMessages)
      );
    } catch (error) {
      toast.error("Failed to load messages");
    }
  }

  function saveMessages(updatedMessages: Message[]) {
    try {
      localStorage.setItem(
        "whatsapp_messages",
        JSON.stringify(updatedMessages)
      );
      setMessages(updatedMessages);
    } catch (error) {
      toast.error("Failed to save messages");
    }
  }

  function openModal(message?: Message) {
    if (message) {
      setEditingMessage(message);
      setFormTitle(message.title);
      setFormContent(message.content);
      setFormCategory(message.category);
      setFormImageUrl(message.imageUrl || "");
    } else {
      setEditingMessage(null);
      setFormTitle("");
      setFormContent("");
      setFormCategory(CATEGORIES[0]);
      setFormImageUrl("");
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingMessage(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory(CATEGORIES[0]);
    setFormImageUrl("");
  }

  function handleSave() {
    if (!formTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!formContent.trim()) {
      toast.error("Please enter message content");
      return;
    }

    const now = new Date().toISOString();

    if (editingMessage) {
      // Update existing message
      const updatedMessages = messages.map((msg) =>
        msg.id === editingMessage.id
          ? {
              ...msg,
              title: formTitle.trim(),
              content: formContent.trim(),
              category: formCategory,
              imageUrl: formImageUrl.trim() || undefined,
              updatedAt: now,
            }
          : msg
      );
      saveMessages(updatedMessages);
      toast.success("Message updated successfully");
    } else {
      // Create new message
      const newMessage: Message = {
        id: Date.now().toString(),
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        imageUrl: formImageUrl.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      saveMessages([...messages, newMessage]);
      toast.success("Message created successfully");
    }

    closeModal();
  }

  function handleDelete(id: string) {
    if (window.confirm("Are you sure you want to delete this message?")) {
      const updatedMessages = messages.filter((msg) => msg.id !== id);
      saveMessages(updatedMessages);
      toast.success("Message deleted");
    }
  }

  async function handleCopy(msg: Message) {
    try {
      if (msg.imageUrl) {
        // Try to copy image to clipboard
        try {
          const response = await fetch(msg.imageUrl);
          const blob = await response.blob();

          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob,
            }),
          ]);

          setCopiedId(msg.id);
          toast.success(
            <div>
              <div className="font-semibold">Image copied! 📸</div>
              <div className="text-xs mt-1">
                Now paste in WhatsApp, then copy & send the text below
              </div>
            </div>,
            { duration: 4000 }
          );

          // Auto-copy text after a short delay
          setTimeout(async () => {
            try {
              await navigator.clipboard.writeText(msg.content);
              toast.success("Message text copied! Ready to paste 💬");
            } catch (e) {
              // Silent fail - user can manually copy
            }
          }, 1500);
        } catch (imgError) {
          // If image copy fails, just copy text
          await navigator.clipboard.writeText(msg.content);
          setCopiedId(msg.id);
          toast.error(
            <div>
              <div className="font-semibold">Image copy not supported</div>
              <div className="text-xs mt-1">
                Text copied. Please download image separately
              </div>
            </div>,
            { duration: 4000 }
          );
        }
      } else {
        // Copy only text
        await navigator.clipboard.writeText(msg.content);
        setCopiedId(msg.id);
        toast.success("Message copied! 💬");
      }

      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error("Failed to copy. Please try again.");
    }
  }

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || msg.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
              <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Messages</h1>
              <p className="text-sm text-gray-500">
                Manage pre-saved messages for customers
              </p>
            </div>
          </div>

          <button
            onClick={() => openModal()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            New Message
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages Grid */}
      {filteredMessages.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">
            {searchQuery
              ? "No messages found"
              : "No messages yet. Create your first message!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{msg.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {msg.category}
                    </span>
                    {msg.imageUrl && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
                        <Image className="w-3 h-3" />
                        Image
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {msg.imageUrl && (
                <div className="mb-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img
                    src={msg.imageUrl}
                    alt="Message preview"
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-3 max-h-40 overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                  {msg.content}
                </pre>
              </div>

              <div className="text-xs text-gray-500 mb-3">
                Updated: {new Date(msg.updatedAt).toLocaleDateString()}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(msg)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>

                <button
                  onClick={() => openModal(msg)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(msg.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingMessage ? "Edit Message" : "New Message"}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g., Welcome Message"
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {formImageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img
                        src={formImageUrl}
                        alt="Preview"
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Message Content
                  </label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Enter your message here..."
                    rows={12}
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent font-sans text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Tip: Copy and paste emojis and formatted text directly
                    into the message
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                >
                  <Save className="w-4 h-4" />
                  {editingMessage ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}