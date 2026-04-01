"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const STORAGE_KEY = "dashboard-theme";

const getSystemTheme = (): Theme => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = React.useState<Theme>("light");

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const next = stored === "dark" || stored === "light" ? stored : getSystemTheme();
    setTheme(next);
  }, []);

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 ${
        compact ? "px-2 py-1" : "px-2.5 py-1.5"
      }`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {compact ? null : <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
