"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  Id: string;
  Username: string;
  Email: string;
  Role: string;
};

const ADMIN_ONLY_ROUTES = [
  "/finance",
  "/expenses",
  "/reports",
  "/users",
  "/settings",
];

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("authUser");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const role = user?.Role || "";
  const isAdmin = role === "Admin";

  function canAccess(path: string): boolean {
    if (!user) return false;
    if (isAdmin) return true;
    return !ADMIN_ONLY_ROUTES.some((r) => path.startsWith(r));
  }

  function logout() {
    localStorage.removeItem("authUser");
    setUser(null);
  }

  return { user, role, isAdmin, loading, canAccess, logout };
}

export { ADMIN_ONLY_ROUTES };
