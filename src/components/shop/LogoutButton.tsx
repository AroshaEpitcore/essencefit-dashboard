"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutCustomer } from "@/app/(shop)/account/actions";

export default function LogoutButton() {
  const router = useRouter();
  async function out() {
    await logoutCustomer();
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={out} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-red-500">
      <LogOut className="w-4 h-4" /> Sign out
    </button>
  );
}
