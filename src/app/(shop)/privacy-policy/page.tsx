import type { Metadata } from "next";
import { getPublicStoreSettings } from "@/lib/storeSettings";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How we collect, use and protect your personal information.",
};

export default async function PrivacyPolicyPage() {
  const settings = await getPublicStoreSettings();
  const store = settings.storeName || "our store";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">
        Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="space-y-6 text-gray-700 leading-relaxed">
        <section>
          <p>
            {store} respects your privacy. This policy explains what personal information we collect
            when you shop with us, how we use it, and the choices you have.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Information we collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Order details</strong> — your name, delivery address, phone number and email
              address, so we can process and deliver your order.
            </li>
            <li>
              <strong>Account information</strong> — if you create an account, the details you
              provide and your order history.
            </li>
            <li>
              <strong>Usage data</strong> — basic information about how you use the site (such as
              pages viewed), collected through cookies to help us improve the store.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">How we use your information</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To process, pack and deliver your orders.</li>
            <li>To contact you about your order, returns or exchanges.</li>
            <li>To respond to your questions and provide customer support.</li>
            <li>To improve our products, website and service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sharing your information</h2>
          <p>
            We do not sell your personal information. We only share it with the delivery and courier
            partners needed to fulfil your order, and where required by law. These partners are only
            given the details necessary to deliver your parcel.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Data security &amp; retention</h2>
          <p>
            We take reasonable steps to protect your information and keep it only for as long as
            needed to run our business and meet legal obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your choices</h2>
          <p>
            You can ask us to access, correct or delete the personal information we hold about you,
            and you can manage cookies through your browser settings. See our{" "}
            <a href="/cookie-policy" className="text-primary underline hover:no-underline">Cookie Policy</a>{" "}
            for more on how we use cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact us</h2>
          <p>
            If you have any questions about this policy or your personal information, contact us
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
