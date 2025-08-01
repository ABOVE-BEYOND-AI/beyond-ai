"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "./button";

interface ThemeToggleProps {
  showLabel?: boolean;
}

export function ThemeToggle({ showLabel = true }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Get saved theme from localStorage or default to dark
    const savedTheme = localStorage.getItem("theme");
    const isDarkMode = savedTheme ? savedTheme === "dark" : true;
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
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
          className={`h-8 w-8 p-0 ${!isDark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDark(true)}
          className={`h-8 w-8 p-0 ${isDark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Moon className="h-4 w-4" />
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