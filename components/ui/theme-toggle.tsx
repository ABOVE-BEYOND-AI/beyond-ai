"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface ThemeToggleProps {
  showLabel?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ThemeToggle(props: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme");
    const isDarkMode = savedTheme === "dark";
    setIsDark(isDarkMode);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark, mounted]);

  if (!mounted) {
    return <div className="w-[60px] h-[32px] shrink-0" />;
  }

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="relative flex items-center w-[60px] h-[32px] rounded-full p-1 transition-colors duration-300 bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]"
      aria-label="Toggle theme"
    >
      {/* Sun Icon (Background) */}
      <div className="absolute left-[8px] z-0 flex items-center justify-center pointer-events-none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-black/30 dark:text-white/30 transition-colors">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      </div>

      {/* Moon Icon (Background) */}
      <div className="absolute right-[8px] z-0 flex items-center justify-center pointer-events-none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-black/30 dark:text-white/30 transition-colors">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </div>

      {/* Sliding Thumb */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="relative z-10 flex items-center justify-center size-[24px] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15),_0_1px_2px_rgba(0,0,0,0.1),_inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.5),_inset_0_1px_1px_rgba(255,255,255,1)] ring-1 ring-black/5"
        animate={{
          x: isDark ? 28 : 0,
        }}
      >
        <motion.div
          initial={false}
          animate={{
            rotate: isDark ? 0 : -90,
            scale: isDark ? 1 : 0,
            opacity: isDark ? 1 : 0
          }}
          transition={{ duration: 0.3, ease: "backOut" }}
          className="absolute"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-black drop-shadow-sm">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </motion.div>

        <motion.div
          initial={false}
          animate={{
            rotate: isDark ? 90 : 0,
            scale: isDark ? 0 : 1,
            opacity: isDark ? 0 : 1
          }}
          transition={{ duration: 0.3, ease: "backOut" }}
          className="absolute"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-black drop-shadow-sm">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        </motion.div>
      </motion.div>
    </button>
  );
}
