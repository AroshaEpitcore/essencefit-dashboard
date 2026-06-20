import { Space_Grotesk, Archivo } from "next/font/google";

// Body — modern, square-ish geometric sans used across the storefront (admin keeps Inter).
export const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Headings — a bolder square grotesque, exposed as a CSS variable so it only
// applies to storefront headings (h1/h2/h3) via globals.css.
export const headingFont = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-heading",
});
