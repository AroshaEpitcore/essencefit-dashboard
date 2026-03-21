"use client";

import "../globals.css";
import { Inter } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import FullScreenLoader from "@/components/ui/FullScreenLoader";
import { usePageLoader } from "@/lib/hooks/usePageLoader";
import { useAuth } from "@/lib/useAuth";
import { ArrowUp } from "lucide-react";
import FloatingCalculator from "@/components/ui/FloatingCalculator";

const inter = Inter({ subsets: ["latin"] });

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setShowBackToTop(el.scrollTop > 300);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [authorized]);

  if (authLoading || !authorized) {
    return <FullScreenLoader />;
  }

  return (
    <div className="flex h-screen relative">
      {loading && <FullScreenLoader />}

      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1">
        <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6 transition-opacity duration-300">
          {children}
          <FloatingCalculator />
          {showBackToTop && (
            <button
              onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all"
              aria-label="Back to top"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
