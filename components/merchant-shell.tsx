"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Megaphone, MessageCircle, Settings } from "lucide-react";

import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { ThemeToggle } from "@/components/theme-toggle";

type MerchantShellProps = {
  active: "overview" | "operational" | "programs" | "feedback";
  children: React.ReactNode;
};

const navItems = [
  { key: "overview", label: "Overview", href: "/" },
  { key: "operational", label: "Operational", href: "/operational" },
  { key: "programs", label: "Programs & Promotion", href: "/programs" },
  { key: "feedback", label: "Feedback Center", href: "/feedback" },
] as const;

const iconByKey = {
  overview: BarChart3,
  operational: Settings,
  programs: Megaphone,
  feedback: MessageCircle,
} as const;

export function MerchantShell({ active, children }: MerchantShellProps) {
  const router = useRouter();
  const { identity } = useDashboardFilters();
  const [collapsed, setCollapsed] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [showMobileNavLabels, setShowMobileNavLabels] = React.useState(false);
  const lastScrollY = React.useRef(0);
  const hideLabelsTimeout = React.useRef<number | null>(null);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  };

  const scheduleHideLabels = () => {
    if (hideLabelsTimeout.current) {
      window.clearTimeout(hideLabelsTimeout.current);
    }
    hideLabelsTimeout.current = window.setTimeout(() => {
      setShowMobileNavLabels(false);
    }, 1200);
  };

  React.useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      const diff = current - lastScrollY.current;
      const threshold = 6;
      if (Math.abs(diff) > threshold) {
        setShowMobileNavLabels(diff > 0);
        lastScrollY.current = current;
        scheduleHideLabels();
      }
    };

    const handleTouch = () => {
      setShowMobileNavLabels(true);
      scheduleHideLabels();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchstart", handleTouch, { passive: true });
    window.addEventListener("touchmove", handleTouch, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouch);
      window.removeEventListener("touchmove", handleTouch);
      if (hideLabelsTimeout.current) {
        window.clearTimeout(hideLabelsTimeout.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900">
      <div className="mx-auto flex max-w-[1800px]">
        <header className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-600" />
            <div className="text-sm font-semibold tracking-wide text-slate-800">MerchantPoint</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ThemeToggle compact />
            <span className="max-w-[140px] truncate">{identity?.email ?? "-"}</span>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "..." : "Log out"}
            </button>
          </div>
        </header>

        <aside
          className={`sticky top-0 hidden h-screen border-r border-slate-200 bg-white px-3 py-4 transition-all md:block ${
            collapsed ? "w-[76px]" : "w-[240px]"
          }`}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-600" />
              {!collapsed ? <div className="text-sm font-semibold tracking-wide text-slate-800">MerchantPoint</div> : null}
            </div>
            <div className="flex items-center gap-2">
              {collapsed ? null : <ThemeToggle compact />}
              <button
                type="button"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => setCollapsed((prev) => !prev)}
              >
                {collapsed ? ">" : "<"}
              </button>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.key === active;
              const Icon = iconByKey[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                    <Icon className="h-5 w-5" />
                  </span>
                  {collapsed ? null : <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
            {!collapsed ? (
              <>
                <div className="mb-1 font-semibold text-slate-600">Login Account</div>
                <div className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{identity?.email ?? "-"}</div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Merchant key: <span className="font-mono">{identity?.merchantKey?.slice(0, 8) ?? "-"}</span>
                </div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                Out
              </button>
            )}
          </div>
        </aside>
        <section className="min-w-0 flex-1 px-0 py-3 pt-16 pb-20 md:pt-3 md:pb-3">{children}</section>
      </div>

      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white px-3 transition-all duration-200 md:hidden ${
          showMobileNavLabels ? "py-2" : "py-1"
        }`}
      >
        <div className="grid grid-cols-4 gap-2">
          {navItems.map((item) => {
            const isActive = item.key === active;
            const Icon = iconByKey[item.key];
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center rounded-lg px-2 py-1 text-[10px] font-semibold ${
                  isActive ? "text-red-700" : "text-slate-500"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`text-[9px] text-center leading-tight transition-all duration-200 ${
                    showMobileNavLabels
                      ? "mt-1 max-h-4 opacity-100 translate-y-0"
                      : "mt-0 max-h-0 opacity-0 -translate-y-1 pointer-events-none overflow-hidden"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
