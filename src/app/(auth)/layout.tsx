import "../globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${inter.className} min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900`}
    >
      {children}
    </div>
  );
}
