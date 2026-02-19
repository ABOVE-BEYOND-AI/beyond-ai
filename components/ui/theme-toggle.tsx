"use client";

import { useState, useEffect } from "react";
import { SunDim, Moon } from "@phosphor-icons/react";
import { Button } from "./button";

interface ThemeToggleProps {
  showLabel?: boolean;
}

export function ThemeToggle({ showLabel = true }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Get saved theme from localStorage or default to light
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
    return null; // Avoid hydration mismatch
  }

  if (!showLabel) {
    // Simple toggle button without container
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsDark(!isDark)}
        className="size-8 p-0 text-muted-foreground hover:text-foreground"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <SunDim className="size-4" weight="bold" /> : <Moon className="size-4" weight="bold" />}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center bg-muted/50 rounded-lg p-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDark(false)}
          className={`size-8 p-0 ${!isDark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          aria-label="Switch to light mode"
        >
          <SunDim className="size-4" weight="bold" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDark(true)}
          className={`size-8 p-0 ${isDark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          aria-label="Switch to dark mode"
        >
          <Moon className="size-4" weight="bold" />
        </Button>
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {isDark ? 'Dark' : 'Light'} mode
        </span>
      )}
    </div>
  );
}
