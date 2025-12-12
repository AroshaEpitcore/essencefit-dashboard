"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function FullScreenLoader() {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // ⏱ Wait 10 s before fading out
    const visibleTimer = setTimeout(() => setFadeOut(true), 10000);
    // 🕒 Fully remove after fade duration (≈11 s total)
    const hideTimer = setTimeout(() => setShow(false), 11000);

    return () => {
      clearTimeout(visibleTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: fadeOut ? 0 : 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center 
                     bg-white dark:bg-gray-950 backdrop-blur-xl"
        >
          {/* Essence Fit Logo */}
          <motion.img
            src="https://essencefits.com/wp-content/uploads/2025/06/cropped-cropped-cropped-logo-black-130x63.png"
            alt="Essence Fit"
            className="w-40 h-auto mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />

          {/* Animated Gradient Ring */}
          <motion.svg
            width="80"
            height="80"
            viewBox="0 0 50 50"
            className="mb-6"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          >
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1A71FC" />
                <stop offset="100%" stopColor="#2FBD64" />
              </linearGradient>
            </defs>
            <circle
              cx="25"
              cy="25"
              r="20"
              stroke="url(#grad)"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
              strokeDashoffset="0"
            />
          </motion.svg>

          {/* Tagline */}
          <motion.p
            className="text-gray-700 dark:text-gray-300 font-medium text-sm tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Empowering Performance…
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
