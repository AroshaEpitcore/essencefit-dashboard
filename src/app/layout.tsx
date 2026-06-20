import "./globals.css";
import { Inter } from "next/font/google";
import LoadingWrapper from "./loading-wrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Essencefit",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white`}>
        <LoadingWrapper>{children}</LoadingWrapper>
      </body>
    </html>
  );
}
