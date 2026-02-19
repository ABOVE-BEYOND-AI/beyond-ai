"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
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
  const rankSize = large ? "size-14 text-xl" : "size-10 text-base";
  const nameSize = large
    ? (isTop3 ? "text-xl" : "text-lg text-foreground/80")
    : (isTop3 ? "text-base" : "text-sm text-foreground/80");
  const amountSize = large
    ? (isTop3 ? "text-2xl" : "text-lg text-foreground/70")
    : (isTop3 ? "text-lg" : "text-sm text-foreground/70");

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex items-center gap-4 ${large ? "p-5" : "p-4"} rounded-xl transition-colors ${
        isTop3 ? "bg-foreground/[0.04] border border-foreground/[0.06]" : ""
      }`}
    >
      <div
        className={`flex items-center justify-center ${rankSize} rounded-full font-bold shrink-0 ${
          index === 0
            ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-lg shadow-yellow-500/20"
            : index === 1
              ? "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700 shadow-lg shadow-gray-400/20"
              : index === 2
                ? "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-lg shadow-amber-600/20"
                : "bg-muted/60 text-muted-foreground"
        }`}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${nameSize}`}>{rep.name}</p>
        <p className={`text-muted-foreground ${large ? "text-sm" : "text-xs"}`}>
          {rep.deal_count} deal{rep.deal_count !== 1 ? "s" : ""}
        </p>
      </div>
      <p className={`font-bold tabular-nums shrink-0 ${amountSize}`}>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex items-center gap-4 ${large ? "p-5" : "p-4"} rounded-xl bg-foreground/[0.03] border border-foreground/[0.04]`}
    >
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${large ? "text-lg" : "text-sm"}`}>
          {clientName(deal.Name)}
        </p>
        <div className={`flex items-center gap-2 mt-0.5 ${large ? "text-sm" : ""}`}>
          <span className={`text-muted-foreground ${large ? "text-sm" : "text-xs"}`}>{owner}</span>
          {event && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className={`text-muted-foreground/70 truncate ${large ? "text-sm" : "text-xs"}`}>{event}</span>
            </>
          )}
        </div>
      </div>
      <p className={`font-bold tabular-nums shrink-0 ${large ? "text-xl" : "text-base"}`}>
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
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-3 rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          aria-label="Close fullscreen"
        >
          <X className="size-6" />
        </button>

        <div className="h-full overflow-y-auto p-8 lg:p-12">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            {view === "leaderboard" ? (
              <FontAwesomeIcon icon={faTrophy} className="h-8 w-8 text-yellow-500" />
            ) : (
              <CurrencyGbp className="size-8 text-green-500" weight="bold" />
            )}
            <h1 className="text-3xl font-bold tracking-tight text-balance">
              {view === "leaderboard" ? "Sales Leaderboard" : "Recent Deals"}
            </h1>
            <span className="text-xl text-muted-foreground">{periodLabel(period)}</span>
          </div>

          {/* Content */}
          <div className="max-w-4xl space-y-3">
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
    <DashboardLayout>
      {/* Fullscreen overlay */}
      <FullscreenModal
        view={fullscreenView}
        onClose={() => setFullscreenView(null)}
        leaderboard={leaderboard}
        deals={deals}
        period={selectedPeriod}
      />

      <div className="min-h-dvh bg-gradient-to-br from-background to-muted/20 p-6 pl-24 lg:p-8 lg:pl-24">
        <div className="max-w-7xl mx-auto">

          {/* ── Period Tabs ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center mb-8 mt-6"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-full p-2 shadow-lg relative">
              <div className="flex relative">
                <motion.div
                  className="absolute bg-primary rounded-full shadow-lg"
                  initial={false}
                  animate={{ x: getPillX(selectedPeriod), width: getPillWidth(selectedPeriod) }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ height: "40px", top: "0px" }}
                />
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPeriod(p.key)}
                    className={`relative z-10 py-2.5 text-sm font-medium transition-colors duration-200 text-center ${
                      selectedPeriod === p.key
                        ? "text-primary-foreground"
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
              <div className="font-black tracking-tighter leading-none number-flow-container" style={{ fontSize: "clamp(5rem, 12vw, 10rem)" }}>
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
              {/* Bottom fade overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`subtitle-${selectedPeriod}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-xl text-muted-foreground mt-1 relative z-10"
              >
                {initialLoading ? (
                  <div className="animate-pulse bg-muted/50 h-6 w-48 mx-auto rounded" />
                ) : (
                  `${totals.total_deals} deal${totals.total_deals !== 1 ? "s" : ""} closed ${periodLabel(selectedPeriod)}`
                )}
              </motion.div>
            </AnimatePresence>

            {/* Live indicator */}
            <div className="flex items-center justify-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-green-500" />
                </span>
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
              {lastUpdated && (
                <span className="text-xs text-muted-foreground/50">
                  {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="text-muted-foreground/40 hover:text-foreground transition-colors"
                aria-label="Refresh data"
              >
                <ArrowsClockwise className={`size-3 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
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
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto"
          >
            {/* ── LEADERBOARD CONTAINER ── */}
            <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/[0.06]">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={faTrophy} className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-lg font-semibold tracking-tight">Leaderboard</h2>
                  <span className="text-sm text-muted-foreground">{periodLabel(selectedPeriod)}</span>
                </div>
                <button
                  onClick={() => setFullscreenView("leaderboard")}
                  className="p-2 rounded-lg hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="View leaderboard fullscreen"
                >
                  <ArrowsOut className="size-[18px]" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="p-4 overflow-y-auto max-h-[420px] scrollbar-hide">
                {initialLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-4 rounded-xl">
                        <div className="animate-pulse bg-muted size-10 rounded-full" />
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted h-4 w-28 rounded" />
                        </div>
                        <div className="animate-pulse bg-muted h-5 w-24 rounded" />
                      </div>
                    ))}
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FontAwesomeIcon icon={faCrown} className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No deals closed {periodLabel(selectedPeriod)}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((rep, index) => (
                      <LeaderboardRow key={rep.email || rep.name} rep={rep} index={index} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── RECENT DEALS CONTAINER ── */}
            <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/[0.06]">
                <div className="flex items-center gap-3">
                  <CurrencyGbp className="size-5 text-green-500" weight="bold" />
                  <h2 className="text-lg font-semibold tracking-tight">Recent Deals</h2>
                  <span className="text-sm text-muted-foreground">{periodLabel(selectedPeriod)}</span>
                </div>
                <button
                  onClick={() => setFullscreenView("deals")}
                  className="p-2 rounded-lg hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="View deals fullscreen"
                >
                  <ArrowsOut className="size-[18px]" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="p-4 overflow-y-auto max-h-[420px] scrollbar-hide">
                {initialLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-4 rounded-xl">
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted h-4 w-36 rounded mb-2" />
                          <div className="animate-pulse bg-muted h-3 w-24 rounded" />
                        </div>
                        <div className="animate-pulse bg-muted h-5 w-20 rounded" />
                      </div>
                    ))}
                  </div>
                ) : deals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CurrencyGbp className="size-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No deals closed {periodLabel(selectedPeriod)}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
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
    </DashboardLayout>
  );
}
