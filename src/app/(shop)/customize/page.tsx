import { getDtfPrintableProducts } from "@/lib/storefront";
import { getDtfPricingConfig } from "@/lib/dtfPricing";
import { getDtfPageSettings } from "@/lib/dtfSettings";
import CustomizeForm from "./CustomizeForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customize & DTF Print | EssenceFit" };

export default async function CustomizePage() {
  const [products, pricing, settings] = await Promise.all([
    getDtfPrintableProducts(),
    getDtfPricingConfig(),
    getDtfPageSettings(),
  ]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-gray-900 inline-block border-b-2 border-primary pb-1">
          Customize &amp; DTF Print
        </h1>
        {settings.introNote && (
          <p className="mt-4 max-w-3xl text-gray-600">{settings.introNote}</p>
        )}
      </div>

      <CustomizeForm products={products} pricing={pricing} settings={settings} />
    </div>
  );
}
