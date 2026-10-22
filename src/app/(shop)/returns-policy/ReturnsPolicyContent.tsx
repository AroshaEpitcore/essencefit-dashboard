"use client";

import { useState } from "react";
import { MessageCircle, Phone, Mail } from "lucide-react";
import { waHref } from "@/lib/wa";

type Lang = "en" | "si";

type Section = {
  heading: string;
  intro?: string;
  items?: string[];
  outro?: string[];
  terms?: { title: string; body: string }[];
};

type Copy = {
  title: string;
  intro: string;
  updated: string;
  sections: Section[];
  contactHeading: string;
};

// The two support numbers live in one place so both languages stay in sync.
const PHONES = ["0762946381", "0769689093"];
const PHONE_LABEL = PHONES.join(" / ");

function buildCopy(email: string): Record<Lang, Copy> {
  const emailEn = email ? ` or email ${email}` : "";
  const emailSi = email ? ` හෝ ${email} වෙත ඊමේල් කර` : "";

  return {
    en: {
      title: "Exchange & Returns Policy",
      updated: "Last updated",
      intro: "We offer FREE returns and exchanges for domestic (island-wide) orders.",
      contactHeading: "Need help?",
      sections: [
        {
          heading: "Return conditions",
          intro:
            "All items being returned or exchanged must meet the following conditions, or the request may be denied:",
          items: [
            "Items must be unwashed",
            "Items must be unworn",
            "Items must be in original packaging",
            "Items with pilling may be subject to denial",
            "Items with markings or stains will not be accepted",
            "Items with strong odours (e.g. smoke, cologne, detergent) will not be accepted",
          ],
        },
        {
          heading: "Please note",
          items: [
            "Items discounted 15% or more are not eligible for return or exchange",
            "This policy excludes normal wear and tear, and damage caused by misuse or accidents",
            "We reserve the right to deny returns or exchanges submitted after the applicable window has closed",
          ],
        },
        {
          heading: "How to return your order",
          items: [
            `Submit a return request by contacting us on WhatsApp or calling ${PHONE_LABEL} within 3 days of receiving the product.`,
            "Once the item has been inspected and all return conditions are met, a refund or store credit will be issued (shipping costs excluded).",
            "If store credit is issued instead of a refund, it is sent to the email address on your order and is valid for one year from the date of issue.",
          ],
        },
        {
          heading: "How to exchange your order",
          items: [
            `Exchanges are only valid for size changes, provided the required size is available. Submit an exchange request on WhatsApp or by calling ${PHONE_LABEL} within 3 days of receiving the product. If the requested size isn't available, you may request a return instead.`,
            "Only one exchange per item will be accepted.",
          ],
        },
        {
          heading: "Missing, damaged or incorrect items",
          outro: [
            `If you've received an incorrect item, are missing an item from your order, or received a damaged item, please contact our support team on WhatsApp, call ${PHONE_LABEL}${emailEn}.`,
            "This must be done within 3 days of receiving the order.",
          ],
        },
        {
          heading: "Additional terms & conditions",
          terms: [
            { title: "Courier charges (delivery)", body: "When you send an item to us for an exchange, the applicable courier fee must be borne by the customer, and the courier fee to send the exchanged item back to the customer must also be paid by the customer." },
            { title: "Exchange window", body: "Size exchange requests can only be submitted within 3 days from the date the item was received." },
            { title: "Condition of the item", body: "The item handed over for an exchange must be unused, unwashed and in its original condition." },
            { title: "Used or damaged items", body: "Items damaged due to the customer's use, incorrect washing or negligence will not be exchanged." },
            { title: "Choosing your size", body: "Before placing an order, it is the customer's responsibility to check the size chart and select the correct size." },
            { title: "Getting a size exchange", body: "If the required size is out of stock, exchanging to a different size may be delayed; whether an alternative or a refund is provided will be handled by mutual agreement between both parties." },
            { title: "Receiving a wrong item", body: "If you receive an item different from the one ordered, you must notify our customer support team within 3 days of receiving the item." },
            { title: "Original packaging", body: "When sending an item for an exchange, the original packaging and the item's tags must be included wherever possible." },
            { title: "Discounted items", body: "Items purchased under special discounts, clearance sales or promotional offers are exchanged or returned according to the conditions of the relevant offer." },
            { title: "Custom printed items", body: "Items printed with a name, logo, image or special design at the customer's request cannot be exchanged or returned, unless there is a manufacturing defect or a fault on our part." },
            { title: "Custom / DTF order payment", body: "Custom and DTF printing orders require a 50% advance payment before production begins; the remaining balance is settled on delivery." },
            { title: "Order cancellation", body: "Once an order has been prepared or printing has begun, cancelling it may be restricted. Special conditions may apply to custom orders." },
            { title: "Inspection of the item", body: "The item is inspected before an exchange request is approved. If the applicable conditions are not met, the request may be rejected." },
          ],
        },
      ],
    },
    si: {
      title: "හුවමාරු සහ ආපසු භාර දීමේ ප්‍රතිපත්තිය",
      updated: "අවසන් වරට යාවත්කාලීන කළේ",
      intro: "දේශීය (දිවයින පුරා) ඇණවුම් සඳහා අපි නොමිලේ ආපසු භාර ගැනීම් සහ හුවමාරු ලබා දෙමු.",
      contactHeading: "උදව් අවශ්‍යද?",
      sections: [
        {
          heading: "ආපසු භාර දීමේ කොන්දේසි",
          intro:
            "ආපසු භාර දෙන හෝ හුවමාරු කරන සියලුම භාණ්ඩ පහත කොන්දේසි සපුරාලිය යුතුය. නැතහොත් ඉල්ලීම ප්‍රතික්ෂේප විය හැක:",
          items: [
            "භාණ්ඩ සෝදා නොතිබිය යුතුය",
            "භාණ්ඩ පැළඳ නොතිබිය යුතුය",
            "භාණ්ඩ මුල් ඇසුරුමෙහි තිබිය යුතුය",
            "රැළි (pilling) සහිත භාණ්ඩ ප්‍රතික්ෂේප විය හැක",
            "සලකුණු හෝ පැල්ලම් සහිත භාණ්ඩ භාර නොගනු ලැබේ",
            "තද ගන්ධයක් සහිත (උදා: දුම්, සුවඳ විලවුන්, රෙදි සෝදන කුඩු) භාණ්ඩ භාර නොගනු ලැබේ",
          ],
        },
        {
          heading: "කරුණාකර සලකන්න",
          items: [
            "15% හෝ ඊට වැඩියෙන් වට්ටම් කරන ලද භාණ්ඩ ආපසු භාර ගැනීමට හෝ හුවමාරු කිරීමට සුදුසුකම් නොලබයි",
            "සාමාන්‍ය භාවිතයෙන් සිදුවන ගෙවීයාම් සහ වැරදි භාවිතය හෝ අනතුරු නිසා සිදුවන හානි මෙම ප්‍රතිපත්තියට ඇතුළත් නොවේ",
            "අදාළ කාලසීමාව අවසන් වූ පසු ඉදිරිපත් කරන ආපසු භාර දීම් හෝ හුවමාරු ප්‍රතික්ෂේප කිරීමේ අයිතිය අප සතුය",
          ],
        },
        {
          heading: "ඔබේ ඇණවුම ආපසු භාර දෙන්නේ කෙසේද",
          items: [
            `භාණ්ඩය ලැබී දින 3ක් ඇතුළත WhatsApp හරහා අප හා සම්බන්ධ වී හෝ ${PHONE_LABEL} අමතා ආපසු භාර දීමේ ඉල්ලීමක් ඉදිරිපත් කරන්න.`,
            "භාණ්ඩය පරීක්ෂා කර සියලුම කොන්දේසි සපුරා ඇත්නම්, මුදල් ආපසු ගෙවීමක් හෝ store credit (සාප්පු ණය) ලබා දෙනු ලැබේ (ප්‍රවාහන ගාස්තු හැර).",
            "මුදල් ආපසු ගෙවීම වෙනුවට store credit නිකුත් කරන්නේ නම්, එය ඔබේ ඇණවුමේ සඳහන් ඊමේල් ලිපිනයට එවනු ලබන අතර නිකුත් කළ දිනයේ සිට වසරක් දක්වා වලංගු වේ.",
          ],
        },
        {
          heading: "ඔබේ ඇණවුම හුවමාරු කරන්නේ කෙසේද",
          items: [
            `හුවමාරු කිරීම් වලංගු වන්නේ ප්‍රමාණ (size) වෙනස් කිරීම් සඳහා පමණි, අවශ්‍ය ප්‍රමාණය තිබේ නම්. භාණ්ඩය ලැබී දින 3ක් ඇතුළත WhatsApp හරහා හෝ ${PHONE_LABEL} අමතා හුවමාරු ඉල්ලීමක් ඉදිරිපත් කරන්න. අවශ්‍ය ප්‍රමාණය නොමැති නම්, ඒ වෙනුවට ආපසු භාර දීමක් ඉල්ලිය හැක.`,
            "එක් භාණ්ඩයකට එක් හුවමාරුවක් පමණක් පිළිගනු ලැබේ.",
          ],
        },
        {
          heading: "නැතිවූ, හානිවූ හෝ වැරදි භාණ්ඩ",
          outro: [
            `ඔබට වැරදි භාණ්ඩයක් ලැබී ඇත්නම්, ඇණවුමෙන් භාණ්ඩයක් නොලැබී ඇත්නම්, හෝ හානිවූ භාණ්ඩයක් ලැබී ඇත්නම්, WhatsApp හරහා, ${PHONE_LABEL} අමතා${emailSi} අපගේ සහාය කණ්ඩායම හා සම්බන්ධ වන්න.`,
            "මෙය ඇණවුම ලැබී දින 3ක් ඇතුළත සිදු කළ යුතුය.",
          ],
        },
        {
          heading: "අමතර නීති සහ කොන්දේසි",
          terms: [
            { title: "කුරියර් ගාස්තු (Delivery Charges)", body: "භාණ්ඩයක් මාරු කිරීම සඳහා අප වෙත එවන විට අදාළ කුරියර් ගාස්තුව පාරිභෝගිකයා විසින් දැරිය යුතු අතර, මාරු කරන ලද භාණ්ඩය නැවත පාරිභෝගිකයා වෙත එවීමේ කුරියර් ගාස්තුව ද පාරිභෝගිකයා විසින් ගෙවිය යුතු වේ." },
            { title: "භාණ්ඩ මාරු කිරීමේ කාලසීමාව", body: "භාණ්ඩය ලැබුණු දින සිට දින 3ක් ඇතුළත පමණක් Size Exchange ඉල්ලීම් ඉදිරිපත් කළ හැකිය." },
            { title: "භාණ්ඩයේ තත්ත්වය", body: "මාරු කිරීම සඳහා භාරදෙන භාණ්ඩය භාවිත නොකළ, සෝදා නොමැති සහ මුල් තත්ත්වයේ තිබිය යුතුය." },
            { title: "භාවිත කළ හෝ හානි වූ භාණ්ඩ", body: "පාරිභෝගිකයාගේ භාවිතය, වැරදි සේදීම හෝ නොසැලකිලිමත්කම නිසා හානි වූ භාණ්ඩ මාරු කරනු නොලැබේ." },
            { title: "ප්‍රමාණය (Size) තෝරා ගැනීම", body: "ඇණවුම ලබාදීමට පෙර Size Chart එක පරීක්ෂා කර නිවැරදි ප්‍රමාණය තෝරා ගැනීම පාරිභෝගිකයාගේ වගකීම වේ." },
            { title: "Size Exchange ලබාගැනීම", body: "අවශ්‍ය ප්‍රමාණය තොගයේ නොමැති නම්, වෙනත් ප්‍රමාණයකට මාරු කිරීම ප්‍රමාද විය හැකි අතර, විකල්පයක් ලබාදීම හෝ මුදල් ආපසු ලබාදීම පිළිබඳව දෙපාර්ශ්වයේ එකඟතාව අනුව කටයුතු කරනු ලැබේ." },
            { title: "වැරදි භාණ්ඩයක් ලැබීම", body: "පාරිභෝගිකයා ඇණවුම් කළ භාණ්ඩයට වෙනස් භාණ්ඩයක් ලැබුණහොත්, භාණ්ඩය ලැබී දින 3ක් ඇතුළත අපගේ පාරිභෝගික සහාය කණ්ඩායමට දැනුම් දිය යුතුය." },
            { title: "භාණ්ඩයේ මුල් ඇසුරුම", body: "භාණ්ඩය මාරු කිරීම සඳහා එවන විට, හැකි සෑම විටම මුල් ඇසුරුම සහ භාණ්ඩයට අදාළ ටැග් ඇතුළත් කළ යුතුය." },
            { title: "වට්ටම් සහිත භාණ්ඩ", body: "විශේෂ වට්ටම්, Clearance Sales හෝ Promotional Offers යටතේ මිලදී ගත් භාණ්ඩ මාරු කිරීම හෝ ආපසු භාරගැනීම අදාළ දීමනාවේ කොන්දේසි අනුව සිදු කෙරේ." },
            { title: "Custom Printed භාණ්ඩ", body: "පාරිභෝගිකයාගේ ඉල්ලීම පරිදි නම, ලාංඡනය, රූපය හෝ විශේෂ නිර්මාණයක් මුද්‍රණය කළ භාණ්ඩ, නිෂ්පාදන දෝෂයක් හෝ අපගේ වරදක් නොමැති නම්, මාරු කිරීම හෝ ආපසු භාරගැනීම සිදු නොකෙරේ." },
            { title: "Custom / DTF ඇණවුම් ගෙවීම්", body: "Custom සහ DTF මුද්‍රණ ඇණවුම් සඳහා නිෂ්පාදනය ආරම්භ කිරීමට පෙර 50% ක අත්තිකාරම් ගෙවීමක් අවශ්‍ය වේ; ඉතිරි මුදල භාණ්ඩය බාරදීමේදී ගෙවිය යුතුය." },
            { title: "ඇණවුම් අවලංගු කිරීම", body: "ඇණවුම සකස් කිරීම හෝ මුද්‍රණ කටයුතු ආරම්භ කිරීමෙන් පසු එය අවලංගු කිරීම සීමා කළ හැකිය. Custom Orders සඳහා විශේෂ කොන්දේසි අදාළ විය හැකිය." },
            { title: "භාණ්ඩය පරීක්ෂා කිරීම", body: "මාරු කිරීමේ ඉල්ලීමක් අනුමත කිරීමට පෙර භාණ්ඩය පරීක්ෂා කරනු ලැබේ. අදාළ කොන්දේසි සපුරා නොමැති නම් ඉල්ලීම ප්‍රතික්ෂේප කළ හැකිය." },
          ],
        },
      ],
    },
  };
}

export default function ReturnsPolicyContent({ email }: { email: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const copy = buildCopy(email)[lang];
  const wa = waHref(PHONES[0]);
  const telHref = `tel:${PHONES[0]}`;

  const tabClass = (active: boolean) =>
    `px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
      active ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Language toggle */}
      <div className="flex justify-end mb-6">
        <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button type="button" onClick={() => setLang("en")} className={tabClass(lang === "en")} aria-pressed={lang === "en"}>
            English
          </button>
          <button type="button" onClick={() => setLang("si")} className={tabClass(lang === "si")} aria-pressed={lang === "si"}>
            සිංහල
          </button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.title}</h1>
      <p className="text-sm text-gray-500 mb-8">
        {copy.updated}: {new Date().toLocaleDateString(lang === "si" ? "si-LK" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <p className="text-lg text-gray-900 font-medium">{copy.intro}</p>

        {copy.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{s.heading}</h2>
            {s.intro && <p className="mb-3">{s.intro}</p>}
            {s.items && (
              <ul className="list-disc pl-5 space-y-2">
                {s.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
            {s.outro && s.outro.map((p, i) => <p key={i} className={i > 0 ? "mt-3" : ""}>{p}</p>)}
            {s.terms && (
              <ol className="list-decimal pl-5 space-y-3 marker:font-semibold marker:text-gray-400">
                {s.terms.map((t, i) => (
                  <li key={i}>
                    <span className="font-semibold text-gray-900">{t.title}</span> — {t.body}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}

        {/* Contact card */}
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{copy.contactHeading}</h2>
          <div className="flex flex-wrap gap-3">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary/90 transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            <a
              href={telHref}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-semibold px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              <Phone className="w-4 h-4 text-primary" /> {PHONE_LABEL}
            </a>
            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-semibold px-4 py-2 hover:bg-gray-100 transition-colors"
              >
                <Mail className="w-4 h-4 text-primary" /> {email}
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
