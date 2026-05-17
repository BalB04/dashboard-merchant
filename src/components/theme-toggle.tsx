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
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof document !== "undefined") {
      const current = document.documentElement.dataset.theme;
      if (current === "dark" || current === "light") {
        return current;
      }
    }
    return "light";
  });

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
      className={`inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 ${
        compact ? "px-2.5 py-1.5" : "px-3 py-2"
      }`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </span>
      {compact ? null : <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
