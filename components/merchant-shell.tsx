"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, LogOut, Megaphone, MessageCircle, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";

import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { ThemeToggle } from "@/components/theme-toggle";

type MerchantShellProps = {
  active: "overview" | "operational" | "programs" | "feedback";
  children: React.ReactNode;
};

const navItems = [
  { key: "overview", label: "Overview", mobileLabel: "Home", href: "/" },
  { key: "operational", label: "Operational", mobileLabel: "Analytics", href: "/operational" },
  { key: "programs", label: "Programs & Promotion", mobileLabel: "Programs", href: "/programs" },
  { key: "feedback", label: "Feedback Center", mobileLabel: "Feedback", href: "/feedback" },
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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (hideLabelsTimeout.current) {
        window.clearTimeout(hideLabelsTimeout.current);
      }
    };
  }, []);

  return (
    <div className="dashboard-shell min-h-screen bg-[#F4F6FA] text-slate-900">
      <div className="mx-auto flex max-w-[1800px] gap-5 px-3 pb-4 pt-3 md:px-4">
        <header className="glass-panel fixed left-3 right-3 top-3 z-40 flex items-center justify-between rounded-[24px] border border-slate-200 px-4 py-3 md:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 via-red-400 to-orange-300 text-white shadow-sm">
              <div className="h-3 w-3 rounded-full bg-white/95" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-slate-800">MerchantPoint</div>
              <div className="text-xs font-medium text-slate-500">Analytics workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <ThemeToggle compact />
            <span className="hidden max-w-[140px] truncate sm:inline">{identity?.email ?? "-"}</span>
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "..." : "Log out"}
            </button>
          </div>
        </header>

        <aside
          className={`sidebar-panel sidebar-motion sticky top-3 hidden h-[calc(100vh-1.5rem)] rounded-[24px] border py-4 md:flex md:flex-col ${
            collapsed ? "w-[92px] px-2.5" : "w-[272px] px-3"
          }`}
        >
          <div className={`mb-5 flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
            <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-gradient-to-br from-red-500 via-red-400 to-orange-300 text-white shadow-sm">
                <div className="h-3.5 w-3.5 rounded-full bg-white/95" />
              </div>
              <div className={`sidebar-fade ${collapsed ? "sidebar-fade-hidden" : "sidebar-fade-visible"}`}>
                <div className="min-w-0">
                  <div className="text-base font-bold tracking-tight text-slate-900">MerchantPoint</div>
                  <div className="sidebar-muted text-xs font-medium">Merchant control room</div>
                </div>
              </div>
            </div>
            <div className={`sidebar-fade ${collapsed ? "sidebar-fade-hidden" : "sidebar-fade-visible"}`}>
              <ThemeToggle compact />
            </div>
          </div>

          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`sidebar-control mb-4 flex items-center rounded-[18px] border shadow-sm transition-[background-color,border-color,transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              collapsed ? "justify-center px-0 py-3" : "justify-between px-3 py-2.5"
            }`}
            onClick={() => setCollapsed((prev) => !prev)}
          >
            <span className={`sidebar-icon-chip flex items-center justify-center rounded-2xl ${collapsed ? "h-11 w-11" : "h-9 w-9"}`}>
              {collapsed ? <PanelLeftOpen className="h-4.5 w-4.5" strokeWidth={2.2} /> : <PanelLeftClose className="h-4.5 w-4.5" strokeWidth={2.2} />}
            </span>
            <span className={`sidebar-fade pr-1 text-sm font-semibold ${collapsed ? "sidebar-fade-hidden" : "sidebar-fade-visible"}`}>
              Collapse Sidebar
            </span>
          </button>

          <nav className={`space-y-2 transition-[margin] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "mt-6" : ""}`}>
            {navItems.map((item) => {
              const isActive = item.key === active;
              const Icon = iconByKey[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`group flex items-center rounded-[18px] text-sm transition-[background-color,color,transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive
                      ? "sidebar-nav-item-active"
                      : "sidebar-nav-item-idle"
                  } ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-3"}`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                      isActive
                        ? "sidebar-nav-icon-active"
                        : "sidebar-nav-icon-idle group-hover:border-slate-300 group-hover:bg-white"
                    } ${collapsed ? "h-12 w-12" : ""}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className={`sidebar-fade min-w-0 ${collapsed ? "sidebar-fade-hidden" : "sidebar-fade-visible"}`}>
                    <div className="min-w-0">
                      <span className={`block truncate text-[15px] font-semibold ${isActive ? "text-slate-900" : "text-slate-700"}`}>
                        {item.label}
                      </span>
                      <span className={`block truncate text-xs font-medium ${isActive ? "text-red-500" : "text-slate-500"}`}>
                        {item.key === "overview"
                          ? "KPI and insight"
                          : item.key === "operational"
                            ? "Rules and execution"
                            : item.key === "programs"
                              ? "Campaign monitoring"
                              : "Merchant sentiment"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div
            className={`relative mt-auto text-sm transition-[padding,background-color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              collapsed ? "flex justify-center p-0" : "sidebar-account-panel rounded-[20px] border p-3"
            }`}
          >
            <>
              {collapsed ? null : (
                <div className="sidebar-fade sidebar-fade-visible">
                  <div className="mb-1 font-bold text-slate-800">Login Account</div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700">
                    <span className="block truncate">{identity?.email ?? "-"}</span>
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-500">
                    Merchant key: <span className="font-mono">{identity?.merchantKey?.slice(0, 8) ?? "-"}</span>
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-full border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-[background-color,border-color,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-rose-50 disabled:opacity-50"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              )}
              <button
                type="button"
                aria-label="Log out"
                className={`flex items-center justify-center rounded-[18px] border border-red-100 bg-white text-red-700 shadow-sm transition-[background-color,border-color,transform,opacity,width,height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-red-200 hover:bg-rose-50 ${
                  collapsed
                    ? "h-11 w-11 opacity-100 translate-y-0"
                    : "pointer-events-none absolute inset-x-0 bottom-0 h-14 opacity-0 translate-y-2"
                }`}
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut className="h-4.5 w-4.5" strokeWidth={2.2} />
              </button>
            </>
          </div>
        </aside>
        <section className="min-w-0 flex-1 px-0 py-3 pt-18 pb-24 md:pt-0 md:pb-3">{children}</section>
      </div>

      <nav
        className={`glass-panel fixed bottom-3 left-3 right-3 z-40 rounded-[24px] border border-slate-200 px-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.14)] transition-[padding,background-color,border-color,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          showMobileNavLabels ? "py-2.5" : "py-1.5"
        }`}
      >
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const isActive = item.key === active;
            const Icon = iconByKey[item.key];
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-col items-center justify-center rounded-[18px] px-1.5 text-center transition-[color,background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  showMobileNavLabels ? "min-h-[60px] py-1.5" : "min-h-[42px] py-1"
                } ${
                  isActive
                    ? "bg-rose-50 text-slate-900"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <span
                  className={`flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    showMobileNavLabels ? "h-7" : "h-6"
                  } ${isActive ? "-translate-y-0.5 text-red-700" : ""}`}
                >
                  <Icon className={`${showMobileNavLabels ? "h-[18px] w-[18px]" : "h-[17px] w-[17px]"}`} />
                </span>
                <span
                  className={`text-[10px] text-center font-medium leading-[1.2] transition-[margin,opacity,max-height,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    showMobileNavLabels
                      ? "mt-1 max-h-8 opacity-100 translate-y-0"
                      : "mt-0 max-h-0 opacity-0 -translate-y-1 pointer-events-none overflow-hidden"
                  }`}
                >
                  {item.mobileLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
