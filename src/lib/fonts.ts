import { Montserrat } from "next/font/google";

// Body — Montserrat across the storefront.
export const displayFont = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Headings — Montserrat in heavier weights, exposed as a CSS variable so it only
// applies to storefront headings (h1/h2/h3) via globals.css.
export const headingFont = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-heading",
});
