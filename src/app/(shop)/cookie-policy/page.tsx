import type { Metadata } from "next";
import { getPublicStoreSettings } from "@/lib/storeSettings";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How we use cookies on our website.",
};

export default async function CookiePolicyPage() {
  const settings = await getPublicStoreSettings();
  const store = settings.storeName || "our store";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
      <p className="text-sm text-gray-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="space-y-6 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">What are cookies?</h2>
          <p>
            Cookies are small text files stored on your device when you visit a website. They help
            the site work properly and remember information about your visit.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">How {store} uses cookies</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Essential cookies</strong> — keep you signed in, remember the items in your
              shopping cart, and let you complete checkout. The site cannot work without these.
            </li>
            <li>
              <strong>Preference cookies</strong> — remember choices such as your wishlist and your
              cookie consent, so we don&apos;t ask you again on every visit.
            </li>
            <li>
              <strong>Analytics cookies</strong> — help us understand how visitors use the site so
              we can improve it. These are only set if you accept cookies.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Managing cookies</h2>
          <p>
            When you first visit, you can choose to accept or reject non-essential cookies. You can
            also clear or block cookies at any time through your browser settings. Note that
            blocking essential cookies may stop parts of the store (such as your cart) from working.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact us</h2>
          <p>
            If you have any questions about this policy, contact us
            {settings.contactEmail ? (
              <> at <a href={`mailto:${settings.contactEmail}`} className="text-primary underline hover:no-underline">{settings.contactEmail}</a></>
            ) : null}
            {settings.contactPhone ? <> or call {settings.contactPhone}</> : null}.
          </p>
        </section>
      </div>
    </div>
  );
}
