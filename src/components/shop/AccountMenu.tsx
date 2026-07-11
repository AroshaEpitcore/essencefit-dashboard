"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User, LogOut, Package, UserCircle } from "lucide-react";
import { getMyAccount, logoutCustomer } from "@/app/(shop)/account/actions";

export type NavCustomer = { Name: string; Phone: string | null; Email: string | null } | null;

function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Navbar account control. Fetches the session CLIENT-side (on mount and on
   every route change) instead of receiving it from the layout — the layout
   reading cookies forced every storefront page dynamic and disabled the home
   page's ISR. Until the fetch resolves it shows the anonymous icon. */
export default function AccountMenu({ iconCls }: { iconCls: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [customer, setCustomer] = useState<NavCustomer>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    getMyAccount()
      .then((me) => {
        if (alive) setCustomer(me ? { Name: me.Name, Phone: me.Phone, Email: me.Email } : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function logout() {
    await logoutCustomer();
    setCustomer(null);
    setOpen(false);
    router.refresh();
  }

  if (!customer) {
    return (
      <Link href="/account" className={iconCls} aria-label="Account">
        <User className="w-6 h-6" />
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        title={customer.Name}
        className="w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center ring-2 ring-white/40 hover:opacity-90"
      >
        {initials(customer.Name)}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 text-gray-700">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{customer.Name}</p>
            <p className="text-xs text-gray-400 truncate">{customer.Phone || customer.Email || ""}</p>
          </div>
          <Link href="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
            <UserCircle className="w-4 h-4" /> My account
          </Link>
          <Link href="/account/orders" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
            <Package className="w-4 h-4" /> My orders
          </Link>
          <button onClick={logout} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-gray-50">
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
