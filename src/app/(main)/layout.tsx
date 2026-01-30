"use client";

import "../globals.css";
import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import { usePageLoader } from "@/lib/hooks/usePageLoader";
import { useAuth } from "@/lib/useAuth";

const inter = Inter({ subsets: ["latin"] });

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const loading = usePageLoader();
  const { user, canAccess, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    // not logged in → redirect to login
    if (!user) {
      router.replace("/login");
      return;
    }

    // staff accessing admin-only route → redirect to dashboard
    if (!canAccess(pathname)) {
      router.replace("/dashboard");
      return;
    }

    setAuthorized(true);
  }, [authLoading, user, pathname]);

  if (authLoading || !authorized) {
    return <FullScreenLoader />;
  }

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
