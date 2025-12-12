"use client";

import { useEffect, useState } from "react";
import FullScreenLoader from "@/components/ui/FullScreenLoader";

export default function LoadingWrapper({ children }: { children: React.ReactNode }) {
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 11000); // 10s visible + 1s fade
    return () => clearTimeout(timer);
  }, []);

  if (showLoader) return <FullScreenLoader />;

  // Only render dashboard after loader ends
  return <>{children}</>;
}
