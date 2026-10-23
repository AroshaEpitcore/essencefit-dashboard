"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

/* Auto-logout on inactivity for the admin panel.

   The ef_admin session cookie is a fixed 7-day expiry (see adminAuth.ts) — it
   does NOT track activity. This component adds the missing idle timeout: after
   IDLE_LIMIT_MS with no user activity it warns, then logs the admin out. */

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 min of inactivity → logout
const WARN_BEFORE_MS = 60 * 1000; // show the "still there?" prompt 60s before

export default function IdleLogout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const lastActivity = useRef(Date.now());
  const warningRef = useRef(false);
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARN_BEFORE_MS / 1000));

  const reset = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  const doLogout = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  // Keep a ref copy so the activity listener can read the latest value without
  // being re-registered on every warning toggle.
  useEffect(() => {
    warningRef.current = warning;
  }, [warning]);

  useEffect(() => {
    if (!user) return;

    const onActivity = () => {
      // While the warning is showing, ignore passive activity — the admin must
      // explicitly click "Stay signed in" so an accidental mousemove can't
      // silently cancel the pending logout.
      if (warningRef.current) return;
      reset();
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LIMIT_MS) {
        doLogout();
        return;
      }
      if (idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS) {
        setWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)));
      } else if (warningRef.current) {
        setWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(tick);
    };
  }, [user, reset, doLogout]);

  const stay = () => {
    reset();
    setWarning(false);
  };

  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl text-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Still there?
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          You&apos;ve been inactive for a while. For security you&apos;ll be logged out in{" "}
          <span className="font-mono font-bold text-primary">{secondsLeft}s</span>.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={doLogout}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Log out now
          </button>
          <button
            onClick={stay}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
