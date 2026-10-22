import type { Metadata } from "next";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import ReturnsPolicyContent from "./ReturnsPolicyContent";

export const metadata: Metadata = {
  title: "Exchange & Returns Policy",
  description: "Our free exchange and returns policy for island-wide orders.",
};

export default async function ReturnsPolicyPage() {
  const settings = await getPublicStoreSettings();
  return <ReturnsPolicyContent email={settings.contactEmail} />;
}
