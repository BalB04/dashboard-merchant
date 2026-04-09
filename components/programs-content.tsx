"use client";

import * as React from "react";
import Image from "next/image";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Megaphone,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { DashboardFilterControls } from "@/components/dashboard-filter-controls";
import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { buildFilterSearchParams } from "@/lib/dashboard-filters";
import diningImage from "../images/dining.jpg";
import entertainmentImage from "../images/entertainment.jpg";
import shoppingImage from "../images/shopping.jpg";

type ProgramRow = {
  keyword: string;
  merchantName: string;
  uniqMerchant: string;
  programName: string;
  startPeriod: string;
  endPeriod: string;
  status: "active" | "upcoming" | "expired";
  redeem: number;
  uniqueRedeemer: number;
  burningPoin: number;
  failed: number;
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
    redeem: number;
    uniqueRedeemer: number;
    burningPoin: number;
    failed: number;
  };
};

const numberFmt = new Intl.NumberFormat("id-ID");
const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const providerBannerImageByKey = {
  dining: diningImage,
  entertainment: entertainmentImage,
  shopping: shoppingImage,
} as const;

const featureImages = [shoppingImage, entertainmentImage, diningImage] as const;

const statusTheme = {
  active: {
    chip: "bg-emerald-300/18 text-emerald-50 ring-1 ring-emerald-200/25",
    rosterChip: "bg-emerald-50 text-emerald-700",
    label: "Active",
  },
  upcoming: {
    chip: "bg-amber-200/20 text-amber-50 ring-1 ring-amber-100/25",
    rosterChip: "bg-amber-50 text-amber-700",
    label: "Pending",
  },
  expired: {
    chip: "bg-slate-100/15 text-slate-100 ring-1 ring-white/20",
    rosterChip: "bg-slate-100 text-slate-600",
    label: "Ended",
  },
} as const;

const promotionAccentByIndex = [
  "from-[#4d2357] via-[#9f4f6e] to-[#d08b72]",
  "from-[#101828] via-[#1d3557] to-[#2b5876]",
  "from-[#102542] via-[#19376d] to-[#4f709c]",
] as const;

const fallbackPromotions: Banner[] = [
  {
    id: "fallback-prime-placement",
    imageKey: "shopping",
    title: "Prime Placement Booster",
    subtitle: "Boost placement for high-intent shoppers across merchant discovery surfaces.",
    cta: "Upgrade now",
  },
  {
    id: "fallback-retargeting",
    imageKey: "entertainment",
    title: "Smart Retargeting Engine",
    subtitle: "Reactivate visitors who clicked but did not redeem with automated promo loops.",
    cta: "Activate AI",
  },
];

const fmt = (value: number) => numberFmt.format(value);

const compact = (value: number) => compactFmt.format(value).toLowerCase();

const daysBetween = (endPeriod: string, todayIso: string) =>
  Math.max(
    Math.ceil(
      (new Date(endPeriod).getTime() - new Date(todayIso).getTime()) / (1000 * 60 * 60 * 24),
    ),
    0,
  );

export function ProgramsContent() {
  const { initialized, applied } = useDashboardFilters();
  const monthsKey = React.useMemo(() => applied.months.join(","), [applied.months]);
  const categoriesKey = React.useMemo(() => applied.categories.join(","), [applied.categories]);
  const branchesKey = React.useMemo(() => applied.branches.join(","), [applied.branches]);

  const [data, setData] = React.useState<ProgramsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selectedKeyword, setSelectedKeyword] = React.useState<string | null>(null);
  const [todayIso] = React.useState(() => new Date().toISOString().slice(0, 10));
  const carouselRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        const params = buildFilterSearchParams(applied);
        const response = await fetch(`/api/programs?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to fetch programs");
        }

        const payload = (await response.json()) as ProgramsResponse;
        if (active) {
          React.startTransition(() => {
            setData(payload);
            setSelectedKeyword(
              payload.programs.find((program) => program.status === "active")?.keyword ??
                payload.programs[0]?.keyword ??
                null,
            );
          });
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

  if (!data) {
    return (
      <div className="px-6 py-6 text-sm text-slate-500">{loading ? "Loading..." : "No data"}</div>
    );
  }

  const programs = data.programs;
  const activePrograms = programs.filter((program) => program.status === "active");
  const carouselPrograms = activePrograms.length ? activePrograms : programs;
  const recommendedPromotions = (data.banners.length ? data.banners : fallbackPromotions).slice(
    0,
    2,
  );

  const activeProgramCount = activePrograms.length;
  const selectedProgram =
    carouselPrograms.find((program) => program.keyword === selectedKeyword) ??
    carouselPrograms[0] ??
    programs[0] ??
    null;

  const scrollCarousel = (direction: "prev" | "next") => {
    const node = carouselRef.current;
    if (!node) return;
    const amount = Math.max(node.clientWidth * 0.72, 240);
    node.scrollBy({ left: direction === "next" ? amount : -amount, behavior: "smooth" });
  };

  return (
    <div className="space-y-5 px-4 py-4 md:px-6">
      <section className="programs-hero overflow-hidden rounded-[28px] border border-white/50 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96),_rgba(244,246,250,0.92)_40%,_rgba(233,238,245,0.96)_100%)] p-4 shadow-[0_16px_42px_rgba(15,23,42,0.06)] md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="programs-hero-chip inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Programs & Promotion
            </div>
            <h1 className="mt-3 max-w-2xl text-[28px] font-semibold tracking-tight text-slate-900 md:text-[2rem]">
              Programs & Promotion
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Monitor active programs, live insights, and provider recommendations in one compact
              surface.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ToplineStat label="Month" value={data.monthLabel} />
            <ToplineStat label="Active programs" value={String(activeProgramCount)} />
            <ToplineStat
              label="Unique redeemers"
              value={fmt(data.promotionPerformance.uniqueRedeemer)}
            />
          </div>
        </div>
      </section>

      <DashboardFilterControls />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[20px] font-semibold tracking-tight text-slate-900">
              Active Programs
            </div>
            <div className="text-[12px] text-slate-500">
              Active or nearest programs in the selected filter scope.
            </div>
          </div>
        </div>

        {carouselPrograms.length === 0 ? (
          <div className="programs-empty-state rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-5 py-8 text-sm text-slate-500">
            No program data for selected filters.
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="programs-carousel-button inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                onClick={() => scrollCarousel("prev")}
                aria-label="Previous programs"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="programs-carousel-button inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                onClick={() => scrollCarousel("next")}
                aria-label="Next programs"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div
              ref={carouselRef}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {carouselPrograms.map((program, index) => {
                const isSelected = selectedProgram?.keyword === program.keyword;
                const image = featureImages[index % featureImages.length];
                const status = statusTheme[program.status];
                const daysLeft =
                  program.status === "expired" ? null : daysBetween(program.endPeriod, todayIso);

                return (
                  <article
                    key={program.keyword}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedKeyword(program.keyword)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedKeyword(program.keyword);
                      }
                    }}
                    aria-pressed={isSelected}
                    className={`group relative min-w-[320px] snap-start overflow-hidden rounded-[20px] bg-slate-950 transition duration-300 md:min-w-[360px] xl:min-w-[420px] ${
                      isSelected
                        ? "scale-[1.01] ring-2 ring-sky-400/80 shadow-[0_18px_36px_rgba(14,165,233,0.22)] opacity-100"
                        : "opacity-58 shadow-[0_8px_18px_rgba(15,23,42,0.10)] saturate-[0.82] hover:opacity-82"
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${program.programName} banner`}
                      className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${isSelected ? "scale-[1.02]" : "group-hover:scale-[1.03]"}`}
                      sizes="(min-width: 1280px) 40vw, 100vw"
                    />
                    <div
                      className={`absolute inset-0 ${
                        isSelected
                          ? "bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.26)_40%,rgba(15,23,42,0.78)_100%)]"
                          : "bg-[linear-gradient(180deg,rgba(15,23,42,0.25)_0%,rgba(15,23,42,0.50)_40%,rgba(15,23,42,0.92)_100%)]"
                      }`}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_32%)]" />

                    <div className="relative flex min-h-[168px] flex-col justify-between p-3.5 text-white md:min-h-[182px]">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] ${status.chip}`}
                        >
                          {status.label}
                        </div>
                        {isSelected ? (
                          <span className="rounded-full border border-white/30 bg-white/14 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-white">
                            Selected
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <p className="mt-1.5 max-w-md text-[10px] leading-4 text-white/72">
                          {program.uniqMerchant}
                        </p>
                        <h2 className="mt-1.5 max-w-[20ch] text-[18px] font-semibold leading-[1.05] tracking-tight md:text-[19px]">
                          {program.merchantName}
                        </h2>
                        <div className="text-[8px] font-medium uppercase my-2 tracking-[0.16em] text-white/55">
                          {program.keyword}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          <FeatureMetric label="Redeems" value={fmt(program.redeem)} />
                          <FeatureMetric
                            label="Unique"
                            value={fmt(program.uniqueRedeemer)}
                            accent="text-white"
                          />
                          <FeatureMetric
                            label="Status"
                            value={status.label}
                            accent="text-emerald-300"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1 text-[9px] text-white/65">
                            <CalendarDays className="h-2.5 w-2.5" />
                            {daysLeft === null
                              ? `Ended ${program.endPeriod}`
                              : `Valid until ${program.endPeriod}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="programs-insight-panel rounded-[24px] border border-white/50 bg-[linear-gradient(180deg,#eef3f8_0%,#f8fafc_100%)] p-3.5 shadow-sm md:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[20px] font-semibold tracking-tight text-slate-900">
              {selectedProgram?.merchantName ?? "Live Insights"}
            </div>
            <div className="text-[11px] text-slate-500">
              Selected-month performance for{" "}
              {selectedProgram?.programName ?? "your featured program"}.
            </div>
          </div>
        </div>

        {selectedProgram ? (
          <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <InsightDetail label="Start period" value={selectedProgram.startPeriod} />
            <InsightDetail label="End period" value={selectedProgram.endPeriod} />
            <InsightDetail label="Keyword code" value={selectedProgram.keyword} />
            <InsightDetail label="Recorded redeem" value={fmt(selectedProgram.redeem)} />
          </div>
        ) : null}

        <div className="mt-3 grid gap-2.5 lg:grid-cols-4">
          <InsightCard
            icon={<Target className="h-4 w-4" />}
            label="Redeems"
            value={fmt(selectedProgram?.redeem ?? 0)}
            delta="Successful transactions"
            tone="positive"
          />
          <InsightCard
            icon={<Eye className="h-4 w-4" />}
            label="Unique Redeemer"
            value={fmt(selectedProgram?.uniqueRedeemer ?? 0)}
            delta="Unique MSISDN with success"
            tone="neutral"
          />
          <InsightCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Burning Poin"
            value={compact(selectedProgram?.burningPoin ?? 0)}
            delta={`${fmt(selectedProgram?.burningPoin ?? 0)} total poin`}
            tone="positive"
          />
          <InsightCard
            icon={<Megaphone className="h-4 w-4" />}
            label="Failed"
            value={fmt(selectedProgram?.failed ?? 0)}
            delta="Failed transactions"
            tone={(selectedProgram?.failed ?? 0) > 0 ? "warning" : "neutral"}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-[24px] font-semibold tracking-tight text-slate-900">Promotions</div>
          <div className="text-sm text-slate-500"></div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {recommendedPromotions.map((banner, index) => {
            const image = providerBannerImageByKey[banner.imageKey];

            return (
              <article
                key={banner.id}
                className={`group relative overflow-hidden rounded-[22px]  bg-slate-950 p-4 text-white shadow-[0_14px_28px_rgba(15,23,42,0.15)]`}
              >
                <Image
                  src={image}
                  alt={banner.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-700 group-hover:scale-105"
                  sizes="(min-width: 1280px) 36vw, 100vw"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${promotionAccentByIndex[index % promotionAccentByIndex.length]} opacity-90`}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_35%)]" />

                <div className="relative min-h-[104px]">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    {index === 0 ? "Placement booster" : "Smart engine"}
                  </div>
                  <h3 className="mt-3 max-w-[18ch] text-[22px] font-semibold leading-[1.05] tracking-tight">
                    {banner.title}
                  </h3>
                  <p className="mt-2 max-w-md text-[11px] leading-5 text-white/78">
                    {banner.subtitle}
                  </p>
                  <button
                    type="button"
                    className={`mt-4 rounded-full px-3.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] transition ${
                      index === 1
                        ? "bg-blue-600 text-white hover:bg-blue-500"
                        : "bg-white text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {banner.cta || "Launch promotion"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ToplineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="programs-topline-stat rounded-[18px] border border-white/70 bg-white/78 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-1.5 text-[15px] font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function FeatureMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-white/6 p-2 backdrop-blur-sm">
      <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </div>
      <div className={`mt-1 text-[13px] font-semibold text-white ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function InsightDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="programs-insight-detail rounded-[14px] border border-slate-200/80 bg-white/75 p-3 shadow-sm">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="mt-1.5 text-[12px] font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function InsightCard({
  icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  tone: "positive" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-slate-500";

  return (
    <div className="programs-insight-card rounded-[16px] border border-white/80 bg-white px-3.5 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </div>
        <div className="programs-insight-card-icon flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
      <div className="mt-2 text-[1.45rem] font-semibold leading-none tracking-tight text-slate-900">
        {value}
      </div>
      <div className={`mt-1.5 text-[10px] font-medium ${toneClass}`}>{delta}</div>
    </div>
  );
}
