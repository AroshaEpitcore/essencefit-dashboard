"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function usePageLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 600); // smooth transition
    return () => clearTimeout(timeout);
  }, [pathname]); // triggers whenever route path changes

  return loading;
}
