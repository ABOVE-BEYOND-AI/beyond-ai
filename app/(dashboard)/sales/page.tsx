"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { TrendUp, ArrowsClockwise, CurrencyGbp, ArrowsOut, X } from "@phosphor-icons/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrown, faTrophy } from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import NumberFlow from "@number-flow/react";

// ── Types matching Salesforce API response ──

type SalesPeriod = "today" | "week" | "month" | "year";

interface SalesforceOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  CloseDate: string;
  Amount: number | null;
  Gross_Amount__c: number | null;
  Service_Charge__c: number | null;
  Processing_Fee__c: number | null;
  Owner: { Name: string; Email?: string } | null;
  Account: { Name: string } | null;
  Event__r: { Name: string } | null;
  CreatedDate: string;
}

interface PeriodTotals {
  total_amount: number;
  total_deals: number;
  average_deal: number;
}

interface LeaderboardEntry {
  name: string;
  email: string;
  total_amount: number;
  deal_count: number;
}

interface DashboardResponse {
  period: SalesPeriod;
  totals: PeriodTotals;
  deals: SalesforceOpportunity[];
  leaderboard: LeaderboardEntry[];
  all_totals: Record<SalesPeriod, PeriodTotals>;
}

// ── Config ──

const PERIODS: { key: SalesPeriod; label: string; width: number }[] = [
  { key: "today", label: "Today", width: 80 },
  { key: "week", label: "Week", width: 72 },
  { key: "month", label: "Month", width: 88 },
  { key: "year", label: "Year", width: 72 },
];

const POLL_INTERVAL_MS = 30_000;

// ── Helpers ──

const formatCurrency = (amount: number): string =>
  `£${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatCompact = (amount: number): string =>
  `£${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const periodLabel = (period: SalesPeriod): string => {
  switch (period) {
    case "today": return "today";
    case "week": return "this week";
    case "month": return "this month";
    case "year": return "this year";
  }
};

function getPillX(period: SalesPeriod): number {
  let x = 0;
  for (const p of PERIODS) {
    if (p.key === period) return x;
    x += p.width;
  }
  return 0;
}

function getPillWidth(period: SalesPeriod): number {
  return PERIODS.find((p) => p.key === period)?.width || 80;
}

function clientName(oppName: string): string {
  const parts = oppName.split(" - ");
  return parts[0] || oppName;
}

type FullscreenView = null | "leaderboard" | "deals";

// ── Leaderboard Row (shared between inline and fullscreen) ──

function LeaderboardRow({ rep, index, large = false }: { rep: LeaderboardEntry; index: number; large?: boolean }) {
  const isTop3 = index < 3;
  const rankSize = large ? "size-12 text-xl" : "size-10 text-sm";
  const nameSize = large
    ? (isTop3 ? "text-xl" : "text-lg text-foreground/90")
    : (isTop3 ? "text-sm font-semibold" : "text-sm text-foreground/90 font-medium");
  const amountSize = large
    ? (isTop3 ? "text-2xl" : "text-xl text-foreground/80")
    : (isTop3 ? "text-base font-bold" : "text-sm text-foreground/80 font-semibold");

  // Sleek monochromatic rank badge styling
  let rankStyle = "bg-muted/30 text-muted-foreground border border-border/30";
  let rowStyle = "hover:bg-muted/30 bg-transparent border border-transparent";
  
  if (index === 0) {
    rankStyle = "bg-gradient-to-b from-foreground/10 to-foreground/5 text-foreground border border-border/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]";
    rowStyle = "bg-foreground/[0.03] border border-border/40 dark:bg-foreground/[0.05] dark:border-border/60 shadow-sm";
  } else if (index === 1) {
    rankStyle = "bg-gradient-to-b from-muted/80 to-muted/40 text-foreground/80 border border-border/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]";
    rowStyle = "bg-muted/20 border border-border/20";
  } else if (index === 2) {
    rankStyle = "bg-gradient-to-b from-muted/50 to-muted/20 text-foreground/70 border border-border/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]";
    rowStyle = "bg-muted/10 border border-border/10";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`group flex items-center gap-4 ${large ? "p-5 mb-3 rounded-2xl" : "p-3 mb-2 rounded-xl"} transition-all duration-300 ${rowStyle}`}
    >
      <div className={`flex items-center justify-center ${rankSize} rounded-[12px] font-bold shrink-0 bg-muted/40 backdrop-blur-md border border-border/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04),_0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] transition-transform duration-300 ${rankStyle}`}>
        {index === 0 && large ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-foreground drop-shadow-sm">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ) : (
          index + 1
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`truncate tracking-tight ${nameSize}`}>{rep.name}</p>
        <p className={`text-muted-foreground flex items-center gap-1.5 ${large ? "text-sm mt-1" : "text-[11px] mt-0.5"}`}>
          <span className="inline-block size-1.5 rounded-full bg-primary/20" />
          {rep.deal_count} deal{rep.deal_count !== 1 ? "s" : ""}
        </p>
      </div>
      <p className={`tabular-nums shrink-0 tracking-tight ${amountSize}`}>
        {formatCurrency(rep.total_amount)}
      </p>
    </motion.div>
  );
}

// ── Deal Row (shared between inline and fullscreen) ──

function DealRow({ deal, index, large = false }: { deal: SalesforceOpportunity; index: number; large?: boolean }) {
  const amount = deal.Gross_Amount__c ?? deal.Amount ?? 0;
  const event = deal.Event__r?.Name;
  const owner = deal.Owner?.Name || "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`group flex items-center gap-4 ${large ? "p-5 mb-3 rounded-2xl" : "p-3 mb-2 rounded-xl"} bg-card border border-border/40 hover:border-primary/20 hover:shadow-soft transition-all duration-300 relative overflow-hidden`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/0 to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className={`flex items-center justify-center shrink-0 rounded-[12px] bg-muted/40 backdrop-blur-md border border-border/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04),_0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] transition-transform duration-300 ${large ? "size-12 text-xl" : "size-10 text-sm"}`}>
        <img src="/pounds-cropped.svg" alt="Deal" className={`${large ? "size-5" : "size-4"} invert dark:invert-0 opacity-40`} />
      </div>

      <div className="flex-1 min-w-0 relative z-10">
        <p className={`font-semibold tracking-tight truncate ${large ? "text-lg text-foreground" : "text-sm text-foreground/90"}`}>
          {clientName(deal.Name)}
        </p>
        <div className={`flex items-center gap-2 mt-1 ${large ? "text-sm" : "text-[11px]"}`}>
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-muted-foreground/30" />
            {owner}
          </span>
          {event && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-muted-foreground/70 truncate">{event}</span>
            </>
          )}
        </div>
      </div>
      <p className={`font-bold tabular-nums shrink-0 tracking-tight relative z-10 ${large ? "text-2xl text-foreground" : "text-base text-foreground/90"}`}>
        {formatCurrency(amount)}
      </p>
    </motion.div>
  );
}

// ── Fullscreen Modal ──

function FullscreenModal({
  view,
  onClose,
  leaderboard,
  deals,
  period,
}: {
  view: FullscreenView;
  onClose: () => void;
  leaderboard: LeaderboardEntry[];
  deals: SalesforceOpportunity[];
  period: SalesPeriod;
}) {
  if (!view) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-2xl flex flex-col"
      >
        {/* Subtle mesh background for modal */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background/0 to-background/0 pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 lg:top-10 lg:right-10 z-50 p-4 rounded-full bg-card border border-border/50 shadow-soft hover:shadow-md hover:bg-muted transition-all duration-300 group"
          aria-label="Close fullscreen"
        >
          <X className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" weight="bold" />
        </button>

        <div className="flex-1 overflow-y-auto w-full pt-20 pb-12 px-6 lg:px-12 relative z-10">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="flex items-end gap-5 mb-12 border-b border-border/50 pb-8"
            >
              <div className="shrink-0">
                {view === "leaderboard" ? (
                  <div className="relative flex items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-gray-800 to-black shadow-[0_4px_16px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.3)] dark:from-white dark:to-gray-200 dark:shadow-[0_4px_16px_rgba(255,255,255,0.2),_inset_0_-1px_1px_rgba(0,0,0,0.2)]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-white dark:text-black drop-shadow-md dark:drop-shadow-none">
                      <path d="M18 20V10" />
                      <path d="M12 20V4" />
                      <path d="M6 20V14" />
                    </svg>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center p-4 rounded-[20px] bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_4px_16px_rgba(16,185,129,0.3),_inset_0_1px_1px_rgba(255,255,255,0.5)]">
                    <img src="/pounds-cropped.svg" alt="Deals" className="h-10 w-10 drop-shadow-md brightness-0 invert" />
                  </div>
                )}
              </div>
              <div className="pb-1">
                <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-foreground mb-2">
                  {view === "leaderboard" ? "Sales Leaderboard" : "Recent Deals"}
                </h1>
                <p className="text-xl text-muted-foreground font-medium">
                  Performance overview for <span className="text-foreground">{periodLabel(period)}</span>
                </p>
              </div>
            </motion.div>

            {/* Content */}
            <div className="space-y-0">
              {view === "leaderboard" ? (
                leaderboard.map((rep, index) => (
                  <LeaderboardRow key={rep.email || rep.name} rep={rep} index={index} large />
                ))
              ) : (
                deals.map((deal, index) => (
                  <DealRow key={deal.Id} deal={deal} index={index} large />
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Component ──

export default function SalesPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<SalesPeriod>("month");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fullscreenView, setFullscreenView] = useState<FullscreenView>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
      if (silent) setIsRefreshing(true);
      setError(null);

      try {
        const response = await fetch(`/api/sales/data?period=${selectedPeriod}`);
        if (!response.ok) throw new Error("Failed to fetch sales data");
        const result = await response.json();
        if (result.success) {
          setData(result.data);
          setLastUpdated(new Date());
          hasFetchedOnce.current = true;
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (err) {
        console.error("Error fetching sales data:", err);
        if (!hasFetchedOnce.current)
          setError("Failed to load sales data. Check Salesforce connection.");
      } finally {
        setInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedPeriod]
  );

  useEffect(() => {
    if (user) fetchData(hasFetchedOnce.current);
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, fetchData]);

  // Close fullscreen on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreenView(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // ── Derived values ──
  const allTotals = data?.all_totals;
  const totals: PeriodTotals = allTotals?.[selectedPeriod] || data?.totals || {
    total_amount: 0, total_deals: 0, average_deal: 0,
  };
  const deals = data?.deals || [];
  const leaderboard = data?.leaderboard || [];

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full size-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Fullscreen overlay */}
      <FullscreenModal
        view={fullscreenView}
        onClose={() => setFullscreenView(null)}
        leaderboard={leaderboard}
        deals={deals}
        period={selectedPeriod}
      />

      <div className="min-h-dvh bg-background p-6 pl-24 lg:p-8 lg:pl-32">
        <div className="max-w-7xl mx-auto">

          {/* ── Period Tabs ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center mb-12 mt-10"
          >
            <div className="bg-muted/40 backdrop-blur-md border border-border/80 rounded-full p-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] relative">
              <div className="flex relative items-center">
                {/* Sliding pill */}
                <motion.div
                  className="absolute bg-gradient-to-b from-primary/90 to-primary rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1),_inset_0_1px_1px_rgba(255,255,255,0.25)] dark:shadow-[0_2px_12px_rgba(255,255,255,0.15),_inset_0_1px_1px_rgba(255,255,255,0.8)] ring-1 ring-primary/20 dark:ring-black/20"
                  initial={false}
                  animate={{ x: getPillX(selectedPeriod), width: getPillWidth(selectedPeriod) }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ height: "36px", top: "0px" }}
                />
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPeriod(p.key)}
                    className={`relative z-10 py-2 text-sm font-semibold transition-all duration-200 text-center ${
                      selectedPeriod === p.key
                        ? "text-primary-foreground drop-shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={{ width: `${p.width}px` }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Hero Amount ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-center mb-10"
          >
            <div className="relative">
              <div 
                className="font-black tracking-tighter leading-none number-flow-container pb-2 md:pb-6 [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]" 
                style={{ fontSize: "clamp(5rem, 12vw, 10rem)" }}
              >
                {initialLoading ? (
                  <div className="animate-pulse bg-muted/50 h-36 w-[28rem] mx-auto rounded-xl" />
                ) : (
                  <NumberFlow
                    value={totals.total_amount}
                    format={{ style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                    locales="en-GB"
                    transformTiming={{ duration: 600, easing: "ease-out" }}
                    spinTiming={{ duration: 500, easing: "ease-out" }}
                    opacityTiming={{ duration: 300, easing: "ease-out" }}
                    willChange={false}
                  />
                )}
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`subtitle-${selectedPeriod}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-xl text-muted-foreground -mt-4 md:-mt-8 relative z-10"
              >
                {initialLoading ? (
                  <div className="animate-pulse bg-muted/50 h-6 w-48 mx-auto rounded" />
                ) : (
                  `${totals.total_deals} deal${totals.total_deals !== 1 ? "s" : ""} closed ${periodLabel(selectedPeriod)}`
                )}
              </motion.div>
            </AnimatePresence>

          </motion.div>

          {/* ── Error State ── */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 max-w-5xl mx-auto">
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-4">
                  <p className="text-destructive text-sm">{error}</p>
                  <button onClick={() => fetchData()} className="mt-1 text-sm text-destructive/80 hover:text-destructive underline">
                    Try again
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Leaderboard & Recent Deals ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto"
          >
            {/* ── LEADERBOARD CONTAINER ── */}
            <div className="rounded-[24px] bg-card border border-border/40 shadow-soft overflow-hidden flex flex-col relative group transition-shadow duration-500 hover:shadow-md">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 bg-gradient-to-b from-muted/30 to-card relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center p-2 rounded-[12px] bg-gradient-to-b from-gray-800 to-black shadow-[0_2px_8px_rgba(0,0,0,0.5),_inset_0_1px_1px_rgba(255,255,255,0.3)] dark:from-white dark:to-gray-200 dark:shadow-[0_2px_8px_rgba(255,255,255,0.3),_inset_0_-1px_1px_rgba(0,0,0,0.2)]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-white dark:text-black drop-shadow-md dark:drop-shadow-none">
                      <path d="M18 20V10" />
                      <path d="M12 20V4" />
                      <path d="M6 20V14" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Leaderboard</h2>
                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{periodLabel(selectedPeriod)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setFullscreenView("leaderboard")}
                  className="p-2 rounded-lg bg-background border border-border/50 shadow-sm hover:shadow-md hover:bg-muted/50 hover:text-foreground text-muted-foreground transition-all duration-300"
                  aria-label="View leaderboard fullscreen"
                >
                  <ArrowsOut className="size-4" weight="bold" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="p-4 overflow-y-auto max-h-[460px] scrollbar-hide relative z-10 bg-card">
                {initialLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-xl">
                        <div className="animate-pulse bg-muted size-12 rounded-full" />
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted h-4 w-32 rounded mb-2" />
                          <div className="animate-pulse bg-muted h-3 w-16 rounded" />
                        </div>
                        <div className="animate-pulse bg-muted h-6 w-24 rounded" />
                      </div>
                    ))}
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="relative flex items-center justify-center p-4 rounded-[20px] bg-muted/40 backdrop-blur-md border border-border/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-8 text-muted-foreground/40">
                        <path d="M18 20V10" />
                        <path d="M12 20V4" />
                        <path d="M6 20V14" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium">No deals closed {periodLabel(selectedPeriod)}</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {leaderboard.map((rep, index) => (
                      <LeaderboardRow key={rep.email || rep.name} rep={rep} index={index} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── RECENT DEALS CONTAINER ── */}
            <div className="rounded-[24px] bg-card border border-border/40 shadow-soft overflow-hidden flex flex-col relative group transition-shadow duration-500 hover:shadow-md">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 bg-gradient-to-b from-muted/30 to-card relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center p-2 rounded-[12px] bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_2px_8px_rgba(16,185,129,0.4),_inset_0_1px_1px_rgba(255,255,255,0.5)]">
                    <img src="/pounds-cropped.svg" alt="Deals" className="size-4 drop-shadow-md brightness-0 invert" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Recent Deals</h2>
                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{periodLabel(selectedPeriod)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setFullscreenView("deals")}
                  className="p-2 rounded-lg bg-background border border-border/50 shadow-sm hover:shadow-md hover:bg-muted/50 hover:text-foreground text-muted-foreground transition-all duration-300"
                  aria-label="View deals fullscreen"
                >
                  <ArrowsOut className="size-4" weight="bold" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="p-4 overflow-y-auto max-h-[460px] scrollbar-hide relative z-10 bg-card">
                {initialLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-xl">
                        <div className="animate-pulse bg-muted size-10 rounded-full" />
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted h-4 w-40 rounded mb-2" />
                          <div className="animate-pulse bg-muted h-3 w-24 rounded" />
                        </div>
                        <div className="animate-pulse bg-muted h-6 w-20 rounded" />
                      </div>
                    ))}
                  </div>
                ) : deals.length === 0 ? (
                  <div className="text-center flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="relative flex items-center justify-center p-4 rounded-[20px] bg-muted/40 backdrop-blur-md border border-border/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] mb-4">
                      <img src="/pounds-cropped.svg" alt="No deals" className="size-8 invert dark:invert-0 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">No deals closed {periodLabel(selectedPeriod)}</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {deals.map((deal, index) => (
                      <DealRow key={deal.Id} deal={deal} index={index} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Bottom stats bar ── */}
          {!initialLoading && allTotals && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 max-w-6xl mx-auto"
            >
              <div className="flex items-center justify-center gap-8 py-4 border-t border-border/20">
                {PERIODS.filter((p) => p.key !== selectedPeriod).map((p) => {
                  const t = allTotals[p.key];
                  return (
                    <button
                      key={p.key}
                      onClick={() => setSelectedPeriod(p.key)}
                      className="flex items-center gap-3 text-muted-foreground/60 hover:text-foreground transition-colors group"
                    >
                      <span className="text-xs uppercase tracking-wider">{p.label}</span>
                      <span className="text-sm font-semibold text-foreground/50 group-hover:text-foreground transition-colors tabular-nums">
                        {formatCompact(t?.total_amount || 0)}
                      </span>
                      <span className="text-xs text-muted-foreground/40 tabular-nums">
                        {t?.total_deals || 0} deals
                      </span>
                    </button>
                  );
                })}
                {totals.average_deal > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground/40 pl-4 border-l border-border/20">
                    <TrendUp className="size-3.5" />
                    <span className="text-xs">Avg deal</span>
                    <span className="text-sm font-semibold text-foreground/50 tabular-nums">
                      {formatCompact(totals.average_deal)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
