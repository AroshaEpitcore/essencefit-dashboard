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
  Sparkles,
  BookOpen,
  Ruler,
} from "lucide-react";
import { getProductCategories, getSizesWithColors } from "./actions";

type Message = {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
};

type SalesTemplate = {
  id: string;
  title: string;
  content: string;
  step: string;
  language: "English" | "සිංහල";
};

const CATEGORIES = [
  "Order Confirmation",
  "Payment Reminder",
  "Delivery Update",
  "Follow Up",
  "Product Info",
  "Custom",
];

const SALES_TEMPLATES: SalesTemplate[] = [
  // English Templates
  {
    id: "sales-en-1",
    title: "Welcome — Hook Message",
    step: "Step 1",
    language: "English",
    content: `Hi! 👋 Welcome to EssenceFit 💪

🩳 Dry-Fit Shorts — Rs. 990
👕 CK Active Tee — Rs. 1,500

⭐ 500+ happy customers island-wide!
🚚 Buy 3 = FREE delivery

🤸 Perfect for the gym, home, 🧳 travel, or anywhere you want to wear them

Which item are you interested in? 😊`,
  },
  {
    id: "sales-en-2",
    title: "Size Inquiry",
    step: "Step 2",
    language: "English",
    content: `What size would you like?

M | L | XL | 2XL

Then I can send you the colors for your size`,
  },
  {
    id: "sales-en-3",
    title: "Color Options & Upsell",
    step: "Step 3",
    language: "English",
    content: `Here are the colors available in your size:
🔵 Navy | ⚫ Black | 🔴 Red | 🟢 Olive

Which ones do you like?
💡 Tip: Grab 3 and delivery is on us — FREE! 🚚`,
  },
  {
    id: "sales-en-4",
    title: "Collect Order Details",
    step: "Step 4",
    language: "English",
    content: `Awesome! To get your order out fast, just send me:

1️⃣ Name
2️⃣ Address
3️⃣ Phone number

We'll have it at your door in 2-3 days 🚚✅`,
  },
  {
    id: "sales-en-5",
    title: "Follow-Up — No Reply",
    step: "Follow Up",
    language: "English",
    content: `Hey! 😊 Still thinking about those shorts?

🔥 They're selling fast — only a few left in your size!

Want me to hold one for you? Just let me know your size and I'll sort it out 👍`,
  },
  {
    id: "sales-en-6",
    title: "Delivery Rates",
    step: "Info",
    language: "English",
    content: `📦 Delivery Charges

🏙️ Colombo → Rs. 300
🌍 Outstation → Rs. 350
🗺️ Eastern & Northern → Rs. 400

🚚 FREE delivery when you order 3+ items!

Want to place an order? 😊`,
  },
  {
    id: "sales-en-7",
    title: "Eastern/Northern — Payment",
    step: "Payment",
    language: "English",
    content: `📦 Delivery Info — Eastern & Northern Province

Delivery: Rs. 400 (or FREE on 3+ items!)

✅ We use advance payment for your area to guarantee fast dispatch.

🏦 HNB — Koggala Branch
👤 M.G.Arosha Ravishan
🔢 237020072483

Just send the receipt and we'll ship same day! 🚀`,
  },
  {
    id: "sales-en-8",
    title: "Post-Purchase Review",
    step: "After Sale",
    language: "English",
    content: `Hey! 👋 Hope you're loving your EssenceFit gear! 💪

Your feedback means the world to us. Could you take 30 seconds to leave a quick review?

⭐ It helps other customers find us too!

Thank you so much for your support! 🙏`,
  },
  // Sinhala Templates
  {
    id: "sales-si-1",
    title: "පිළිගැනීම — ආකර්ශනය",
    step: "පියවර 1",
    language: "සිංහල",
    content: `ආයුබෝවන්! 👋 EssenceFit වෙත සාදරයෙන් පිළිගනිමු 💪

🩳 Dry-Fit Shorts — Rs. 990
👕 CK Active Tee — Rs. 1,500

⭐ දිවයින පුරා සතුටු පාරිභෝගිකයින් 500+!
🚚 3ක් ගත්තොත් delivery එක FREE!

ඔයාට කැමති item එක මොකද? 😊`,
  },
  {
    id: "sales-si-2",
    title: "සයිස් එක අහන එක",
    step: "පියවර 2",
    language: "සිංහල",
    content: `නියමයි! 🔥
ඔයාට ඕන size එක මොකද?

M | L | XL | 2XL

ඔයාගේ size එකට තියෙන colors බලලා දන්නම් 👍`,
  },
  {
    id: "sales-si-3",
    title: "වර්ණ තේරීම සහ Upsell",
    step: "පියවර 3",
    language: "සිංහල",
    content: `ඔයාගේ size එකට මේ colors තියෙනවා:
🔵 Navy | ⚫ Black | 🔴 Red | 🟢 Olive

කැමති ඒව මොනවද?
💡 3ක් ගත්තොත් delivery එක අපිගෙන් FREE! 🚚`,
  },
  {
    id: "sales-si-4",
    title: "ඇණවුම් විස්තර ගන්න",
    step: "පියවර 4",
    language: "සිංහල",
    content: `නියමයි! ඔයාගේ order එක ඉක්මනින් එවන්න මට මේවා එවන්න:

1️⃣ නම
2️⃣ ලිපිනය
3️⃣ දුරකථන අංකය

දවස් 2-3න් ඔයාගේ ගෙදරටම එවනවා 🚚✅`,
  },
  {
    id: "sales-si-5",
    title: "Follow-Up — පිළිතුරක් නැත",
    step: "Follow Up",
    language: "සිංහල",
    content: `හායි! 😊 තාමත් shorts ගැන හිතනවද?

🔥 ඉක්මනට ඉවර වෙනවා — ඔයාගේ size එකේ ටිකක් විතරයි ඉතිරි!

ඔයාට එකක් තියාගන්නද? Size එක කියන්න, මම arrange කරන්නම් 👍`,
  },
  {
    id: "sales-si-6",
    title: "බෙදාහැරීම් ගාස්තු",
    step: "තොරතුරු",
    language: "සිංහල",
    content: `📦 බෙදාහැරීම් ගාස්තු

🏙️ කොළඹ → Rs. 300
🌍 පිටස්තර → Rs. 350
🗺️ නැගෙනහිර සහ උතුරු → Rs. 400

🚚 අයිතම 3ක් හෝ ඊට වැඩි නම් delivery FREE!

Order එකක් දානවද? 😊`,
  },
  {
    id: "sales-si-7",
    title: "නැගෙනහිර/උතුරු — ගෙවීම",
    step: "ගෙවීම",
    language: "සිංහල",
    content: `📦 බෙදාහැරීම — නැගෙනහිර සහ උතුරු පළාත

Delivery: Rs. 400 (අයිතම 3+ නම් FREE!)

✅ ඔයාගේ ප්‍රදේශයට ඉක්මන් dispatch එකක් සහතික කරන්න අපි advance payment භාවිතා කරනවා.

🏦 HNB — කොග්ගල ශාඛාව
👤 M.G.Arosha Ravishan
🔢 237020072483

Receipt එක එවන්න, අපි එදිනම dispatch කරනවා! 🚀`,
  },
  {
    id: "sales-si-8",
    title: "මිලදී ගත් පසු Review",
    step: "විකිණීමෙන් පසු",
    language: "සිංහල",
    content: `හායි! 👋 EssenceFit gear එක enjoy කරනවා කියලා හිතනවා! 💪

ඔයාගේ feedback එක අපිට ගොඩක් වටිනවා. තත්පර 30ක් ගන්න review එකක් දාන්න පුළුවන්ද?

⭐ එයින් අනිත් customers ලටත් අපව හොයාගන්න උදව් වෙනවා!

ඔයාගේ support එකට ගොඩක් ස්තුතියි! 🙏`,
  },
];

export default function WhatsAppMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "sales">("my");
  const [salesLanguage, setSalesLanguage] = useState<"All" | "English" | "සිංහල">("All");
  const [productCategories, setProductCategories] = useState<
    { Id: string; Name: string }[]
  >([]);
  const [selectedProductCategory, setSelectedProductCategory] = useState("");
  const [sizesWithColors, setSizesWithColors] = useState<
    { size: string; colors: { name: string; qty: number }[] }[]
  >([]);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formImageUrl, setFormImageUrl] = useState("");

  // Load messages from storage on mount
  useEffect(() => {
    loadMessages();
  }, []);

  // Load product categories
  useEffect(() => {
    getProductCategories()
      .then((cats) => {
        setProductCategories(cats);
        if (cats.length > 0) setSelectedProductCategory(cats[0].Id);
      })
      .catch(() => toast.error("Failed to load categories"));
  }, []);

  // Load sizes with colors when category changes
  useEffect(() => {
    if (!selectedProductCategory) return;
    setSizesWithColors([]);
    getSizesWithColors(selectedProductCategory)
      .then(setSizesWithColors)
      .catch(() => toast.error("Failed to load sizes/colors"));
  }, [selectedProductCategory]);

  async function handleSizeCopy(
    sizeName: string,
    language: "English" | "සිංහල"
  ) {
    const sizeData = sizesWithColors.find(
      (s) => s.size.toLowerCase() === sizeName.toLowerCase()
    );

    const colorList = sizeData?.colors
      .map((c) => `• ${c.name}`)
      .join("\n");

    const message =
      language === "English"
        ? `${sizeName}\n\nHere are the colors available:\n${colorList || "No colors available"}\n\nWhich ones do you like?\n💡 Tip: Grab 3 and delivery is on us — FREE! 🚚`
        : `${sizeName}\n\n මේ colors තියෙනවා:\n${colorList || "Colors නැත"}\n\nකැමති ඒව මොනවද?\n💡 3ක් ගත්තොත් delivery එක අපිගෙන් FREE! 🚚`;

    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(`size-${sizeName}-${language}`);
      toast.success(`${sizeName} colors copied! 💬`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

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
Dry-fit unisex shorts Rs. 990/-
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
          title: "Size & Color Inquiry",
          content: `
I'm Natasha from EssenceFit 👋

Size Kohomada sir / miss ?
Mata Puluwan colors list eka danna oyaage size ekaṭa
---

How about the size, sir/miss?
Then I can send you the colors for your size
`,
          category: "Product Info",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "3",
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
          id: "4",
          title: "Terms & Conditions (Eastern/Northern)",
          content: `📋 Terms & Conditions - Eastern & Northern Province

📦 Delivery Charges:
• Eastern & Northern Province → Rs. 400
• Other Areas → Rs. 350

🚚 Free Delivery Offer:
• Order more than 3 items → FREE delivery!
• Just add Rs. 50 extra to order price (no additional delivery charges)

⚠️ Important Notice for Eastern & Northern Province:
❌ COD (Cash on Delivery) is NOT available
📝 Reason: Most customers return parcels and don't answer phone calls

✅ To confirm your order, please make the payment to:
🏦 Bank: HNB (Hatton National Bank)
📍 Branch: Koggala
👤 Account Name: M.G.Arosha Ravishan
🔢 Account Number: 237020072483

📸 After payment, please send the receipt to confirm your order.
We will ensure order responsibility after payment confirmation ✅

---

📋 කොන්දේසි - නැගෙනහිර සහ උතුරු පළාත

📦 බෙදාහැරීම් ගාස්තු:
• නැගෙනහිර සහ උතුරු පළාත → Rs. 400
• අනෙකුත් ප්‍රදේශ → Rs. 350

🚚 නොමිලේ බෙදාහැරීම:
• අයිතම 3කට වඩා ඇණවුම් කරන්න → නොමිලේ බෙදාහැරීම!
• ඇණවුම් මිලට Rs. 50ක් පමණක් එකතු කරන්න (අමතර බෙදාහැරීම් ගාස්තු නැත)

⚠️ නැගෙනහිර සහ උතුරු පළාතට වැදගත් දැනුම්දීම:
❌ COD (භාණ්ඩ ලැබුණු පසු මුදල් ගෙවීම) නොමැත
📝 හේතුව: බොහෝ පාරිභෝගිකයින් පාර්සල් ආපසු එවන අතර දුරකථනවලට පිළිතුරු දෙන්නේ නැත

✅ ඔබේ ඇණවුම තහවුරු කිරීමට, කරුණාකර මෙම ගිණුමට මුදල් ගෙවන්න:
🏦 බැංකුව: HNB
📍 ශාඛාව: කොග්ගල
👤 ගිණුම් නම: M.G.Arosha Ravishan
🔢 ගිණුම් අංකය: 237020072483

📸 ගෙවීමෙන් පසු, ඔබේ ඇණවුම තහවුරු කිරීමට රිසිට්පත එවන්න.
ගෙවීම් තහවුරු කිරීමෙන් පසු අපි ඇණවුම් වගකීම සහතික කරමු ✅`,
          category: "Product Info",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "5",
          title: "Delivery & Product Info",
          content: `📦 Delivery Charges
Colombo Area → Rs. 300
Outer Areas → Rs. 350
Eastern & Northern Province → Rs. 400

Our shorts are made with Dry-Fit, Stretchable fabric — perfect for gym, sports, travel, or everyday wear. Breathable, quick-dry & super comfortable ✅
Each short is Rs. 990 ✅ but we have an ongoing offer: Buy 3 & get FREE delivery 🚚
Perfect for gym, sports, travel, or everyday wear. Breathable, quick-dry & super comfortable ✅

Before placing your order, feel free to check our customer reviews and see why people love EssenceFit 💪👖
👉 https://www.facebook.com/profile.php?id=61575738370531&sk=reviews
Quality, comfort & fast delivery 🚚✨`,
          category: "Product Info",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "6",
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
          id: "7",
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
          id: "8",
          title: "Bank Details",
          content: `🏦 Payment Details - EssenceFit

Please make your payment to the following account:

🏦 Bank: HNB (Hatton National Bank)
📍 Branch: Koggala
👤 Account Name: M.G.Arosha Ravishan
🔢 Account Number: 237020072483

📸 After payment, please send the receipt to confirm your order.
Thank you! ✅`,
          category: "Payment Reminder",
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

  async function handleCopy(msg: Message | SalesTemplate) {
    try {
      const hasImage = "imageUrl" in msg && msg.imageUrl;

      if (hasImage) {
        // Try to copy image to clipboard
        try {
          const response = await fetch((msg as Message).imageUrl!);
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

  // Filter sales templates
  const filteredSalesTemplates = SALES_TEMPLATES.filter((t) =>
    salesLanguage === "All" ? true : t.language === salesLanguage
  );

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

          {activeTab === "my" && (
            <button
              onClick={() => openModal()}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              New Message
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("my")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "my"
                ? "bg-green-600 text-white"
                : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            My Templates
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "sales"
                ? "bg-green-600 text-white"
                : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Sales Templates
          </button>
        </div>

        {/* Search and Filter — My Templates */}
        {activeTab === "my" && (
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
        )}

        {/* Language Filter — Sales Templates */}
        {activeTab === "sales" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sales-driven conversation flow templates. Copy and send step by step for better conversions.
            </p>
            <div className="flex gap-2">
              {(["All", "English", "සිංහල"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSalesLanguage(lang)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    salesLanguage === lang
                      ? "bg-green-600 text-white"
                      : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* My Templates Grid */}
      {activeTab === "my" && (
        <>
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
        </>
      )}

      {/* Sales Templates Grid */}
      {activeTab === "sales" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSalesTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{template.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {template.step}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        template.language === "English"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      }`}
                    >
                      {template.language}
                    </span>
                  </div>
                </div>
                {(template.id === "sales-en-3" ||
                  template.id === "sales-si-3") && (
                  <select
                    value={selectedProductCategory}
                    onChange={(e) =>
                      setSelectedProductCategory(e.target.value)
                    }
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500"
                  >
                    {productCategories.map((cat) => (
                      <option key={cat.Id} value={cat.Id}>
                        {cat.Name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-3 max-h-40 overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                  {template.content}
                </pre>
              </div>

              {/* Size buttons for Color Options & Upsell templates */}
              {(template.id === "sales-en-3" ||
                template.id === "sales-si-3") && (
                <div className="mb-3 border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50/50 dark:bg-amber-900/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Ruler className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Copy with available colors by size:
                    </span>
                  </div>

                  {/* Size Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {sizesWithColors.length > 0 ? (
                      sizesWithColors.map((s) => (
                        <button
                          key={`${template.id}-${s.size}`}
                          onClick={() =>
                            handleSizeCopy(s.size, template.language)
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                            copiedId ===
                            `size-${s.size}-${template.language}`
                              ? "bg-green-600 text-white"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                          }`}
                        >
                          {copiedId ===
                          `size-${s.size}-${template.language}` ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Ruler className="w-3 h-3" />
                          )}
                          {s.size}
                          <span className="text-[10px] opacity-70">
                            ({s.colors.length} colors)
                          </span>
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">
                        No stock available
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(template)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm"
                >
                  {copiedId === template.id ? (
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
