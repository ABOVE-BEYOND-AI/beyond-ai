"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, RefreshCw, PoundSterling } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrown } from "@fortawesome/free-solid-svg-icons";
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

const POLL_INTERVAL_MS = 30_000; // 30 seconds

// ── Helpers ──

const formatCurrency = (amount: number): string =>
  `£${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const periodLabel = (period: SalesPeriod): string => {
  switch (period) {
    case "today":
      return "today";
    case "week":
      return "this week";
    case "month":
      return "this month";
    case "year":
      return "this year";
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

// ── Component ──

export default function SalesPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true); // Only true until first successful fetch
  const [selectedPeriod, setSelectedPeriod] = useState<SalesPeriod>("month");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin");
    }
  }, [user, loading, router]);

  // Fetch data from Salesforce API
  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
      if (silent) setIsRefreshing(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/sales/data?period=${selectedPeriod}`
        );
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
        if (!hasFetchedOnce.current) setError("Failed to load sales data. Check Salesforce connection.");
      } finally {
        setInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedPeriod]
  );

  // Initial fetch + re-fetch on period change
  useEffect(() => {
    if (user) fetchData(hasFetchedOnce.current); // silent if we already have data
  }, [user, fetchData]);

  // Polling — refresh every 30s
  useEffect(() => {
    if (!user) return;

    pollRef.current = setInterval(() => {
      fetchData(true); // silent refresh
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, fetchData]);

  // ── Derived values ──
  // Use all_totals for instant tab switching (NumberFlow animates the number)
  // Fall back to data.totals for the selected period
  const allTotals = data?.all_totals;
  const totals: PeriodTotals = allTotals?.[selectedPeriod] || data?.totals || {
    total_amount: 0,
    total_deals: 0,
    average_deal: 0,
  };
  const deals = data?.deals || [];
  const leaderboard = data?.leaderboard || [];

  // ── Render guards ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ── UI ──

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 lg:p-8 pl-24">
        <div className="max-w-7xl mx-auto">
          {/* ── Period Tabs ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center mb-12 mt-10"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-full p-2 shadow-lg relative">
              <div className="flex relative">
                {/* Sliding pill */}
                <motion.div
                  className="absolute bg-primary rounded-full shadow-lg"
                  initial={false}
                  animate={{
                    x: getPillX(selectedPeriod),
                    width: getPillWidth(selectedPeriod),
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ height: "40px", top: "0px" }}
                />
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPeriod(p.key)}
                    className={`
                      relative z-10 py-2.5 text-sm font-medium transition-colors duration-200 text-center
                      ${
                        selectedPeriod === p.key
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    `}
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
            className="text-center mb-16"
          >
            <div className="relative">
              <div className="text-8xl lg:text-9xl font-black tracking-tighter leading-none number-flow-container">
                {initialLoading ? (
                  <div className="animate-pulse bg-muted/50 h-32 w-96 mx-auto rounded-xl" />
                ) : (
                  <NumberFlow
                    value={totals.total_amount}
                    format={{
                      style: "currency",
                      currency: "GBP",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }}
                    locales="en-GB"
                    transformTiming={{ duration: 600, easing: "ease-out" }}
                    spinTiming={{ duration: 500, easing: "ease-out" }}
                    opacityTiming={{ duration: 300, easing: "ease-out" }}
                    willChange={false}
                  />
                )}
              </div>
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-full h-20 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`subtitle-${selectedPeriod}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-xl text-muted-foreground mt-2 relative z-10"
              >
                {initialLoading ? (
                  <div className="animate-pulse bg-muted/50 h-6 w-48 mx-auto rounded" />
                ) : (
                  `${totals.total_deals} deal${totals.total_deals !== 1 ? "s" : ""} closed ${periodLabel(selectedPeriod)}`
                )}
              </motion.div>
            </AnimatePresence>

            {/* Live indicator + last updated */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
              {lastUpdated && (
                <span className="text-xs text-muted-foreground/60">
                  Updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </motion.div>

          {/* ── Summary Stats Row ── */}
          {allTotals && !initialLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12"
            >
              {PERIODS.map((p) => {
                const t = allTotals[p.key];
                const isActive = p.key === selectedPeriod;
                return (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPeriod(p.key)}
                    className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                      isActive
                        ? "border-primary/50 bg-primary/5 shadow-md"
                        : "border-border/30 bg-card/30 hover:border-border/60 hover:bg-card/50"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {p.label}
                    </p>
                    <p className={`text-lg font-bold ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                      {formatCurrency(t?.total_amount || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t?.total_deals || 0} deal{(t?.total_deals || 0) !== 1 ? "s" : ""}
                    </p>
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* ── Error State ── */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 max-w-5xl mx-auto"
            >
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-6">
                  <p className="text-destructive">{error}</p>
                  <button
                    onClick={() => fetchData()}
                    className="mt-2 text-sm text-destructive/80 hover:text-destructive underline"
                  >
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
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto"
          >
            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg">
                    <FontAwesomeIcon
                      icon={faCrown}
                      className="h-6 w-6 text-white"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Sales Leaderboard</CardTitle>
                    <CardDescription>
                      Top performers {periodLabel(selectedPeriod)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {initialLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="animate-pulse bg-muted h-8 w-8 rounded-full" />
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted h-4 w-24 rounded mb-1" />
                          <div className="animate-pulse bg-muted h-3 w-16 rounded" />
                        </div>
                        <div className="animate-pulse bg-muted h-4 w-20 rounded" />
                      </div>
                    ))}
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FontAwesomeIcon
                      icon={faCrown}
                      className="h-12 w-12 mx-auto mb-2 opacity-50"
                    />
                    <p>No sales data yet</p>
                    <p className="text-sm">
                      Closed deals will appear here from Salesforce
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {leaderboard.map((rep, index) => (
                      <motion.div
                        key={rep.email || rep.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shadow-sm ${
                            index === 0
                              ? "bg-yellow-400 text-yellow-900"
                              : index === 1
                                ? "bg-gray-300 text-gray-700"
                                : index === 2
                                  ? "bg-amber-600 text-amber-100"
                                  : "bg-white text-black"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{rep.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {rep.deal_count} deal
                            {rep.deal_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(rep.total_amount)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Deals */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-green-400 to-teal-500 shadow-lg">
                    <PoundSterling className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Recent Deals</CardTitle>
                    <CardDescription>
                      Latest closed {periodLabel(selectedPeriod)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {initialLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted h-4 w-32 rounded mb-1" />
                          <div className="animate-pulse bg-muted h-3 w-20 rounded" />
                        </div>
                        <div className="animate-pulse bg-muted h-4 w-16 rounded" />
                      </div>
                    ))}
                  </div>
                ) : deals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <PoundSterling className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No deals yet</p>
                    <p className="text-sm">
                      Closed deals will appear here from Salesforce
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {deals.map((deal, index) => {
                      const amount =
                        deal.Gross_Amount__c ?? deal.Amount ?? 0;
                      return (
                        <motion.div
                          key={deal.Id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {deal.Name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {deal.Owner?.Name || "Unknown"}
                              {deal.Event__r?.Name
                                ? ` • ${deal.Event__r.Name}`
                                : deal.Account?.Name
                                  ? ` • ${deal.Account.Name}`
                                  : ""}
                            </p>
                            <p className="text-xs text-muted-foreground/60">
                              {new Date(deal.CloseDate).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-sm">
                              {formatCurrency(amount)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Average Deal Size ── */}
          {!initialLoading && totals.average_deal > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-6 max-w-5xl mx-auto"
            >
              <Card className="border-border/30 bg-card/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Average Deal Size</p>
                        <p className="text-xs text-muted-foreground">
                          {periodLabel(selectedPeriod)}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(totals.average_deal)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
