import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Men's Sportswear, T-Shirts & Custom DTF Printing | Sri Lanka`,
    template: `%s | ${SITE_NAME} Sri Lanka`,
  },
  description:
    "EssenceFit is a Sri Lankan men's fashion & sportswear brand — premium t-shirts, oversized tees, polos, shorts and custom DTF-printed apparel. Island-wide delivery & cash on delivery.",
  keywords: [
    "mens sportswear Sri Lanka",
    "mens fashion Sri Lanka",
    "t shirts Sri Lanka",
    "oversized t shirts Sri Lanka",
    "polo t shirts Sri Lanka",
    "shorts Sri Lanka",
    "gym wear Sri Lanka",
    "activewear Sri Lanka",
    "streetwear Sri Lanka",
    "custom DTF printing Sri Lanka",
    "custom t shirt printing Sri Lanka",
    "online clothing store Sri Lanka",
    "EssenceFit",
  ],
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    locale: "en_LK",
    title: `${SITE_NAME} — Men's Sportswear & Custom DTF Printing in Sri Lanka`,
    description:
      "Premium men's t-shirts, oversized tees, polos, shorts & custom DTF-printed apparel. Island-wide delivery across Sri Lanka.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Men's Sportswear & Custom DTF Printing | Sri Lanka`,
    description:
      "Premium men's t-shirts, oversized tees, polos, shorts & custom DTF-printed apparel. Island-wide delivery across Sri Lanka.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png" }],
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white`}>
        {children}
      </body>
    </html>
  );
}
