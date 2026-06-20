import "../globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`dark ${inter.className} min-h-screen bg-gray-900 text-gray-100`}>
      {children}
    </div>
  );
}
