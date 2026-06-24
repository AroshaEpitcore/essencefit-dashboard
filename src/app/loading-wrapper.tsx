"use client";

import { useEffect, useState } from "react";
import FullScreenLoader from "@/components/ui/FullScreenLoader";

export default function LoadingWrapper({ children }: { children: React.ReactNode }) {
  // Skip the cosmetic intro splash for automated browsers (Playwright/Selenium set
  // navigator.webdriver) so E2E tests aren't blocked for 11s on every page load.
  // No effect for real users — navigator.webdriver is always false for them.
  const [showLoader, setShowLoader] = useState(
    () => !(typeof navigator !== "undefined" && navigator.webdriver)
  );

  useEffect(() => {
    if (!showLoader) return;
    const timer = setTimeout(() => setShowLoader(false), 11000); // 10s visible + 1s fade
    return () => clearTimeout(timer);
  }, [showLoader]);

  if (showLoader) return <FullScreenLoader />;

  // Only render dashboard after loader ends
  return <>{children}</>;
}
