import { Orbitron, Rajdhani } from "next/font/google";

// Body — Rajdhani across the storefront.
export const displayFont = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Headings — Orbitron, exposed as a CSS variable so it only applies to
// storefront headings (h1/h2/h3) via globals.css.
export const headingFont = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-heading",
});
