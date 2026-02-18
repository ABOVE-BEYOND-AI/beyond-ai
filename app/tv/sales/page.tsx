"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrophy, faCrown } from "@fortawesome/free-solid-svg-icons";
import { PoundSterling, TrendingUp } from "lucide-react";

// ── Types ──

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

const POLL_INTERVAL_MS = 30_000;
const PANEL_CYCLE_MS = 12_000; // Cycle leaderboard/deals every 12s

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

function clientName(oppName: string): string {
  const parts = oppName.split(" - ");
  return parts[0] || oppName;
}

// ── Components ──

function TVLeaderboardRow({ rep, index }: { rep: LeaderboardEntry; index: number }) {
  const isTop3 = index < 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`flex items-center gap-5 p-5 rounded-2xl transition-colors ${
        isTop3 ? "bg-white/[0.05] border border-white/[0.07]" : ""
      }`}
    >
      <div
        className={`flex items-center justify-center w-14 h-14 rounded-full font-bold text-xl shrink-0 ${
          index === 0
            ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-lg shadow-yellow-500/20"
            : index === 1
              ? "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700 shadow-lg shadow-gray-400/20"
              : index === 2
                ? "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-lg shadow-amber-600/20"
                : "bg-muted/60 text-muted-foreground text-lg"
        }`}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${isTop3 ? "text-2xl" : "text-xl text-foreground/80"}`}>
          {rep.name}
        </p>
        <p className="text-muted-foreground text-base mt-0.5">
          {rep.deal_count} deal{rep.deal_count !== 1 ? "s" : ""}
        </p>
      </div>
      <p className={`font-bold tabular-nums shrink-0 ${isTop3 ? "text-3xl" : "text-2xl text-foreground/70"}`}>
        {formatCurrency(rep.total_amount)}
      </p>
    </motion.div>
  );
}

function TVDealRow({ deal, index }: { deal: SalesforceOpportunity; index: number }) {
  const amount = deal.Gross_Amount__c ?? deal.Amount ?? 0;
  const event = deal.Event__r?.Name;
  const owner = deal.Owner?.Name || "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center gap-5 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate text-xl">
          {clientName(deal.Name)}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-muted-foreground text-base">{owner}</span>
          {event && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-muted-foreground/70 truncate text-base">{event}</span>
            </>
          )}
        </div>
      </div>
      <p className="font-bold tabular-nums shrink-0 text-2xl">
        {formatCurrency(amount)}
      </p>
    </motion.div>
  );
}

// ── Auth Gate ──

function TVAccessDenied() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🔒</span>
        </div>
        <h1 className="text-3xl font-bold mb-3">Access Denied</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Invalid or missing access key. Add <code className="text-sm bg-muted/50 px-2 py-0.5 rounded">?key=YOUR_KEY</code> to the URL.
        </p>
      </div>
    </div>
  );
}

function TVLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6" />
        <p className="text-muted-foreground text-xl">Loading TV Display...</p>
      </div>
    </div>
  );
}

// ── Main TV Sales Component ──

function TVSalesContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");

  const [authState, setAuthState] = useState<"loading" | "denied" | "granted">("loading");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedPeriod] = useState<SalesPeriod>("month");
  const [activePanel, setActivePanel] = useState<"leaderboard" | "deals">("leaderboard");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);

  // ── Verify TV access key ──
  useEffect(() => {
    if (!key) {
      setAuthState("denied");
      return;
    }

    fetch(`/api/tv/verify?key=${encodeURIComponent(key)}`)
      .then((res) => {
        if (res.ok) setAuthState("granted");
        else setAuthState("denied");
      })
      .catch(() => setAuthState("denied"));
  }, [key]);

  // ── Fetch data ──
  const fetchData = useCallback(async (silent = false) => {
    if (!silent && !hasFetchedOnce.current) setInitialLoading(true);

    try {
      const response = await fetch(`/api/sales/data?period=${selectedPeriod}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setLastUpdated(new Date());
        hasFetchedOnce.current = true;
      }
    } catch (err) {
      console.error("TV fetch error:", err);
    } finally {
      setInitialLoading(false);
    }
  }, [selectedPeriod]);

  // ── Start polling once authenticated ──
  useEffect(() => {
    if (authState !== "granted") return;
    fetchData(hasFetchedOnce.current);

    pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [authState, fetchData]);

  // ── Auto-cycle panels ──
  useEffect(() => {
    if (authState !== "granted") return;

    cycleRef.current = setInterval(() => {
      setActivePanel((prev) => (prev === "leaderboard" ? "deals" : "leaderboard"));
    }, PANEL_CYCLE_MS);

    return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
  }, [authState]);

  // ── Auth screens ──
  if (authState === "loading") return <TVLoading />;
  if (authState === "denied") return <TVAccessDenied />;

  // ── Derived values ──
  const allTotals = data?.all_totals;
  const totals: PeriodTotals = allTotals?.[selectedPeriod] || data?.totals || {
    total_amount: 0, total_deals: 0, average_deal: 0,
  };
  const deals = data?.deals || [];
  const leaderboard = data?.leaderboard || [];

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background to-muted/10 overflow-hidden flex flex-col">

      {/* ── Top: Hero Amount ── */}
      <div className="flex-shrink-0 pt-8 pb-4 px-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <div className="relative">
            <div
              className="font-black tracking-tighter leading-none number-flow-container"
              style={{ fontSize: "clamp(6rem, 14vw, 12rem)" }}
            >
              {initialLoading ? (
                <div className="animate-pulse bg-muted/50 h-44 w-[36rem] mx-auto rounded-2xl" />
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
            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </div>

          {/* Subtitle */}
          <div className="text-2xl text-muted-foreground mt-1 relative z-10">
            {initialLoading ? (
              <div className="animate-pulse bg-muted/50 h-8 w-64 mx-auto rounded" />
            ) : (
              `${totals.total_deals} deal${totals.total_deals !== 1 ? "s" : ""} closed this month`
            )}
          </div>

          {/* Live indicator + other periods */}
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-sm text-muted-foreground">Live</span>
            </div>
            {lastUpdated && (
              <span className="text-sm text-muted-foreground/50">
                {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}

            {/* Quick period stats */}
            {allTotals && (
              <>
                <div className="h-4 w-px bg-border/30" />
                <div className="flex items-center gap-1.5 text-muted-foreground/50">
                  <span className="text-xs uppercase tracking-wider">Today</span>
                  <span className="text-sm font-semibold">{formatCompact(allTotals.today?.total_amount || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground/50">
                  <span className="text-xs uppercase tracking-wider">Week</span>
                  <span className="text-sm font-semibold">{formatCompact(allTotals.week?.total_amount || 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground/50">
                  <span className="text-xs uppercase tracking-wider">Year</span>
                  <span className="text-sm font-semibold">{formatCompact(allTotals.year?.total_amount || 0)}</span>
                </div>
                {totals.average_deal > 0 && (
                  <>
                    <div className="h-4 w-px bg-border/30" />
                    <div className="flex items-center gap-1.5 text-muted-foreground/40">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="text-xs">Avg</span>
                      <span className="text-sm font-semibold">{formatCompact(totals.average_deal)}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Bottom: Auto-cycling Panels ── */}
      <div className="flex-1 min-h-0 px-10 pb-8">
        <AnimatePresence mode="wait">
          {activePanel === "leaderboard" ? (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="h-full flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-4 shrink-0">
                <FontAwesomeIcon icon={faTrophy} className="h-7 w-7 text-yellow-500" />
                <h2 className="text-2xl font-bold tracking-tight">Leaderboard</h2>
                <span className="text-lg text-muted-foreground">this month</span>

                {/* Panel indicator dots */}
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <div className="w-2.5 h-2.5 rounded-full bg-muted/40" />
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                {initialLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-5 rounded-2xl">
                        <div className="animate-pulse bg-muted h-14 w-14 rounded-full" />
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted h-6 w-40 rounded" />
                        </div>
                        <div className="animate-pulse bg-muted h-7 w-32 rounded" />
                      </div>
                    ))}
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <FontAwesomeIcon icon={faCrown} className="h-14 w-14 mx-auto mb-4 opacity-30" />
                    <p className="text-xl">No deals closed this month yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-5xl mx-auto">
                    {leaderboard.map((rep, index) => (
                      <TVLeaderboardRow key={rep.email || rep.name} rep={rep} index={index} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="deals"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="h-full flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-4 shrink-0">
                <PoundSterling className="h-7 w-7 text-green-500" />
                <h2 className="text-2xl font-bold tracking-tight">Recent Deals</h2>
                <span className="text-lg text-muted-foreground">this month</span>

                {/* Panel indicator dots */}
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                {initialLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-5 rounded-2xl">
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted h-6 w-48 rounded mb-2" />
                          <div className="animate-pulse bg-muted h-4 w-32 rounded" />
                        </div>
                        <div className="animate-pulse bg-muted h-7 w-28 rounded" />
                      </div>
                    ))}
                  </div>
                ) : deals.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <PoundSterling className="h-14 w-14 mx-auto mb-4 opacity-30" />
                    <p className="text-xl">No deals closed this month yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-5xl mx-auto">
                    {deals.map((deal, index) => (
                      <TVDealRow key={deal.Id} deal={deal} index={index} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom branding ── */}
      <div className="shrink-0 pb-4 text-center">
        <p className="text-xs text-muted-foreground/30 tracking-widest uppercase">
          Above + Beyond
        </p>
      </div>
    </div>
  );
}

// ── Default export with Suspense (required for useSearchParams) ──

export default function TVSalesPage() {
  return (
    <Suspense fallback={<TVLoading />}>
      <TVSalesContent />
    </Suspense>
  );
}
