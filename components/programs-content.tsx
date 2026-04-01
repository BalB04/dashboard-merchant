"use client";

import * as React from "react";
import Image from "next/image";

import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { buildFilterSearchParams } from "@/lib/dashboard-filters";
import { ChevronLeft, ChevronRight } from "lucide-react";
import diningImage from "../images/dining.jpg";
import entertainmentImage from "../images/entertainment.jpg";
import shoppingImage from "../images/shopping.jpg";

type ProgramRow = {
  keyword: string;
  programName: string;
  startPeriod: string;
  endPeriod: string;
  status: "active" | "upcoming" | "expired";
  redeem: number;
};

type Banner = {
  id: string;
  imageKey: "dining" | "entertainment" | "shopping";
  title: string;
  subtitle: string;
  cta: string;
};

type ProgramsResponse = {
  month: string;
  monthLabel: string;
  banners: Banner[];
  programs: ProgramRow[];
  promotionPerformance: {
    impression: number;
    clicks: number;
    ctr: number;
    redeemFromPromo: number;
  };
};

const fmt = (value: number) => new Intl.NumberFormat("id-ID").format(value);

const providerBannerImageByKey = {
  dining: diningImage,
  entertainment: entertainmentImage,
  shopping: shoppingImage,
} as const;

export function ProgramsContent() {
  const { initialized, applied } = useDashboardFilters();
  const monthsKey = React.useMemo(() => applied.months.join(","), [applied.months]);
  const categoriesKey = React.useMemo(() => applied.categories.join(","), [applied.categories]);
  const branchesKey = React.useMemo(() => applied.branches.join(","), [applied.branches]);

  const [data, setData] = React.useState<ProgramsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [bannerIndex, setBannerIndex] = React.useState(0);
  const [expandedKeyword, setExpandedKeyword] = React.useState<string | null>(null);
  const [todayIso] = React.useState(() => new Date().toISOString().slice(0, 10));
  const touchStartX = React.useRef<number | null>(null);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        const params = buildFilterSearchParams(applied);
        const response = await fetch(`/api/programs?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Failed to fetch programs");
        }

        const payload = (await response.json()) as ProgramsResponse;
        if (active) {
          setData(payload);
          setBannerIndex(0);
          setExpandedKeyword(payload.programs[0]?.keyword ?? null);
        }
      } catch (error) {
        if (active) console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (initialized && applied.months.length) {
      load();
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [initialized, monthsKey, categoriesKey, branchesKey, applied]);

  const banners = data?.banners ?? [];
  const programs = data?.programs ?? [];

  React.useEffect(() => {
    if (banners.length <= 1) return;

    const timer = window.setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  React.useEffect(() => {
    if (!banners.length && bannerIndex !== 0) {
      setBannerIndex(0);
      return;
    }

    if (banners.length > 0 && bannerIndex >= banners.length) {
      setBannerIndex(0);
    }
  }, [banners.length, bannerIndex]);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || banners.length <= 1) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    const threshold = 40;
    if (Math.abs(delta) >= threshold) {
      setBannerIndex((prev) => (delta > 0 ? (prev - 1 + banners.length) % banners.length : (prev + 1) % banners.length));
    }
    touchStartX.current = null;
  };

  const activeProgramCount = programs.filter((p) => p.status === "active").length;
  const leftColumnPrograms = programs.filter((_, index) => index % 2 === 0);
  const rightColumnPrograms = programs.filter((_, index) => index % 2 === 1);

  const renderProgramCard = (program: ProgramRow) => {
    const isExpanded = expandedKeyword === program.keyword;

    return (
      <div key={program.keyword} className="relative overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
        <Image
          src={shoppingImage}
          alt={`${program.programName} banner`}
          className={`absolute inset-0 h-full w-full ${isExpanded ? "object-contain" : "object-cover"}`}
          sizes="(min-width: 768px) 50vw, 100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/30 to-black/10" />
        <div className="relative p-5 text-white">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold ${
                program.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : program.status === "upcoming"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {program.status}
            </span>
            <button
              type="button"
              className="rounded-full border border-white/70 bg-white/15 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25"
              onClick={() => setExpandedKeyword((prev) => (prev === program.keyword ? null : program.keyword))}
            >
              {isExpanded ? "Collapse" : "View detail"}
            </button>
          </div>
          <div className="text-xl font-semibold">{program.programName}</div>
          <div className="mt-1 text-[12px] text-white/85">{program.keyword}</div>
          <div className="mt-4 text-[11px] text-white/80">
            Valid until <span className="font-semibold text-white">{program.endPeriod}</span>
          </div>
        </div>
        {isExpanded ? (
          <div className="relative border-t border-white/35 bg-black/35 px-4 pb-4 pt-4 text-white">
            <div className="mb-2 text-sm font-semibold">Program Detail</div>
            <div className="grid gap-3 xl:grid-cols-2">
              <DetailItem label="Program Name" value={program.programName} />
              <DetailItem label="Start Period" value={program.startPeriod} />
              <DetailItem label="End Period" value={program.endPeriod} />
              <DetailItem label="Redeem" value={fmt(program.redeem)} />
              <DetailItem
                label="Days Left"
                value={
                  program.status === "expired"
                    ? "-"
                    : `${Math.max(
                        Math.ceil(
                          (new Date(program.endPeriod).getTime() - new Date(todayIso).getTime()) / (1000 * 60 * 60 * 24)
                        ),
                        0
                      )} days`
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  if (!data) {
    return <div className="px-6 py-6 text-sm text-slate-500">{loading ? "Loading..." : "No data"}</div>;
  }

  const currentBanner = banners[bannerIndex];
  const currentBannerImage = currentBanner
    ? providerBannerImageByKey[currentBanner.imageKey]
    : diningImage;

  return (
    <div className="space-y-5 px-4 py-4 md:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-2xl font-semibold text-slate-900">Programs & Promotion</div>
        <div className="mt-1 text-sm text-slate-500">Manage your keyword programs and provider offers.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Provider Promotion</div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">From Provider</span>
        </div>
        <div
          className="group relative overflow-hidden rounded-3xl border border-slate-200 shadow-md"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Image
            src={currentBannerImage}
            alt="Provider promotion banner template"
            className="h-52 w-full object-cover"
            sizes="(min-width: 768px) 600px, 100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/75 via-black/35 to-black/10" />
          {banners.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous banner"
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 -translate-x-2 items-center justify-center text-white/70 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 hover:text-white focus-visible:translate-x-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                onClick={() => setBannerIndex((prev) => (prev - 1 + banners.length) % banners.length)}
              >
                <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
              </button>
              <button
                type="button"
                aria-label="Next banner"
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 translate-x-2 items-center justify-center text-white/70 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 hover:text-white focus-visible:translate-x-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                onClick={() => setBannerIndex((prev) => (prev + 1) % banners.length)}
              >
                <ChevronRight className="h-6 w-6 stroke-[2.5]" />
              </button>
            </>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <div className="text-lg font-semibold">{currentBanner?.title ?? "No Provider Banner"}</div>
            <div className="mt-1 text-sm text-white/90">{currentBanner?.subtitle ?? ""}</div>
            {currentBanner?.cta ? (
              <button type="button" className="mt-4 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white">
                {currentBanner.cta}
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <div className="flex gap-1">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setBannerIndex(index)}
                className={`h-1.5 w-6 rounded-full ${index === bannerIndex ? "bg-red-500" : "bg-slate-200"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-900">My Keyword Programs</div>
            <div className="text-xs text-slate-500">Monitor active and upcoming promotions</div>
          </div>
          <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            Active Program: {activeProgramCount}
          </div>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {programs.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500">No program data for selected filters.</div>
          ) : (
            <>
              <div className="space-y-3 pr-1 md:hidden">{programs.map(renderProgramCard)}</div>
              <div className="hidden items-start gap-3 pr-1 md:grid md:grid-cols-2">
                <div className="space-y-3">{leftColumnPrograms.map(renderProgramCard)}</div>
                <div className="space-y-3">{rightColumnPrograms.map(renderProgramCard)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-900">Promotion Performance</div>
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Total Transactions" value={data.promotionPerformance.impression} />
          <MetricCard label="Unique Redeemer" value={data.promotionPerformance.clicks} />
          <MetricCard label="CTR" value={data.promotionPerformance.ctr} suffix="%" />
          <MetricCard label="Redeem" value={data.promotionPerformance.redeemFromPromo} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">
        {fmt(value)}
        {suffix}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 backdrop-blur-[1px]">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
