"use client";

import "../globals.css";
import { Inter } from "next/font/google";
import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import { usePageLoader } from "@/lib/hooks/usePageLoader";

const inter = Inter({ subsets: ["latin"] });

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const loading = usePageLoader();

  return (
    <div className="flex h-screen relative">
      {loading && <FullScreenLoader />}

      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1">
        <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="flex-1 overflow-y-auto p-6 transition-opacity duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}
