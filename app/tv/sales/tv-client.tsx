"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { TrendingUp } from "lucide-react";

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

const PERIODS: { key: SalesPeriod; label: string; width: number }[] = [
  { key: "today", label: "Today", width: 110 },
  { key: "week", label: "Week", width: 100 },
  { key: "month", label: "Month", width: 120 },
  { key: "year", label: "Year", width: 100 },
];

const PILL_HEIGHT = 44;
const POLL_INTERVAL_MS = 30_000;
const PERIOD_CYCLE_MS = 10_000;

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
  return PERIODS.find((p) => p.key === period)?.width || 110;
}

function clientName(oppName: string): string {
  const parts = oppName.split(" - ");
  return parts[0] || oppName;
}

// ── Icons ──

function BarChartIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20V14" />
    </svg>
  );
}

// ── Row Components ──

function LeaderboardRow({ rep, index }: { rep: LeaderboardEntry; index: number }) {
  // Monochromatic rank styling matching /sales page
  let rankStyle = "bg-muted/30 text-muted-foreground border border-border/30";
  let rowStyle = "bg-transparent border border-transparent";

  if (index === 0) {
    rankStyle = "bg-gradient-to-b from-foreground/10 to-foreground/5 text-foreground border border-border/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]";
    rowStyle = "bg-foreground/[0.05] border border-border/60 shadow-sm";
  } else if (index === 1) {
    rankStyle = "bg-gradient-to-b from-muted/80 to-muted/40 text-foreground/80 border border-border/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]";
    rowStyle = "bg-muted/20 border border-border/20";
  } else if (index === 2) {
    rankStyle = "bg-gradient-to-b from-muted/50 to-muted/20 text-foreground/70 border border-border/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]";
    rowStyle = "bg-muted/10 border border-border/10";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      className={`flex items-center gap-[1.2vw] rounded-2xl transition-all duration-300 ${rowStyle}`}
      style={{ padding: "clamp(10px, 1.2vh, 18px) clamp(12px, 1vw, 20px)", marginBottom: "clamp(4px, 0.5vh, 8px)" }}
    >
      {/* Rank badge */}
      <div
        className={`flex items-center justify-center rounded-[12px] font-bold shrink-0 bg-muted/40 backdrop-blur-md border border-border/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] ${rankStyle}`}
        style={{ width: "clamp(40px, 3vw, 56px)", height: "clamp(40px, 3vw, 56px)", fontSize: "clamp(0.85rem, 1vw, 1.2rem)" }}
      >
        {index + 1}
      </div>

      {/* Name + deals */}
      <div className="flex-1 min-w-0">
        <p
          className={`tracking-tight truncate ${index < 3 ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}
          style={{ fontSize: index < 3 ? "clamp(0.95rem, 1.2vw, 1.4rem)" : "clamp(0.85rem, 1vw, 1.2rem)" }}
        >
          {rep.name}
        </p>
        <p className="text-muted-foreground flex items-center gap-1.5" style={{ fontSize: "clamp(0.65rem, 0.7vw, 0.85rem)", marginTop: "2px" }}>
          <span className="inline-block rounded-full bg-primary/20" style={{ width: "5px", height: "5px" }} />
          {rep.deal_count} deal{rep.deal_count !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Amount */}
      <p
        className={`tabular-nums shrink-0 tracking-tight ${index < 3 ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}
        style={{ fontSize: index < 3 ? "clamp(1rem, 1.3vw, 1.6rem)" : "clamp(0.85rem, 1.05vw, 1.25rem)" }}
      >
        {formatCurrency(rep.total_amount)}
      </p>
    </motion.div>
  );
}

function DealRow({ deal, index }: { deal: SalesforceOpportunity; index: number }) {
  const amount = deal.Gross_Amount__c ?? deal.Amount ?? 0;
  const event = deal.Event__r?.Name;
  const owner = deal.Owner?.Name || "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      className="flex items-center gap-[1.2vw] bg-card border border-border/40 rounded-2xl transition-all duration-300 relative overflow-hidden"
      style={{ padding: "clamp(10px, 1.2vh, 18px) clamp(12px, 1vw, 20px)", marginBottom: "clamp(4px, 0.5vh, 8px)" }}
    >
      {/* Pounds icon badge */}
      <div
        className="flex items-center justify-center shrink-0 rounded-[12px] bg-muted/40 backdrop-blur-md border border-border/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)]"
        style={{ width: "clamp(40px, 3vw, 56px)", height: "clamp(40px, 3vw, 56px)" }}
      >
        <img
          src="/pounds-cropped.svg"
          alt=""
          className="invert-0 opacity-40"
          style={{ width: "clamp(14px, 1.1vw, 20px)", height: "clamp(14px, 1.1vw, 20px)" }}
        />
      </div>

      <div className="flex-1 min-w-0 relative z-10">
        <p
          className="font-semibold tracking-tight truncate text-foreground/90"
          style={{ fontSize: "clamp(0.85rem, 1.05vw, 1.2rem)" }}
        >
          {clientName(deal.Name)}
        </p>
        <div className="flex items-center gap-2" style={{ marginTop: "2px", fontSize: "clamp(0.65rem, 0.7vw, 0.85rem)" }}>
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="rounded-full bg-muted-foreground/30" style={{ width: "5px", height: "5px", display: "inline-block" }} />
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

      <p
        className="font-bold tabular-nums shrink-0 tracking-tight text-foreground/90 relative z-10"
        style={{ fontSize: "clamp(0.95rem, 1.15vw, 1.4rem)" }}
      >
        {formatCurrency(amount)}
      </p>
    </motion.div>
  );
}

// ── Main Client Component ──

export default function TVSalesClient({ initialData }: { initialData: DashboardResponse | null }) {
  const [data, setData] = useState<DashboardResponse | null>(initialData);
  const [selectedPeriod, setSelectedPeriod] = useState<SalesPeriod>("month");
  const [, setIsRefreshing] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Force dark mode for TV ──
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // ── Fetch fresh data ──
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/sales/data?period=${selectedPeriod}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error("TV fetch error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedPeriod]);

  // ── Fetch immediately on period change, then poll every 30s ──
  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchData]);

  // ── Auto-cycle periods ──
  useEffect(() => {
    cycleRef.current = setInterval(() => {
      setSelectedPeriod((prev) => {
        const idx = PERIODS.findIndex((p) => p.key === prev);
        return PERIODS[(idx + 1) % PERIODS.length].key;
      });
    }, PERIOD_CYCLE_MS);
    return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
  }, []);

  // ── Derived values ──
  const allTotals = data?.all_totals;
  const totals: PeriodTotals = allTotals?.[selectedPeriod] || data?.totals || {
    total_amount: 0, total_deals: 0, average_deal: 0,
  };
  const deals = data?.deals || [];
  const leaderboard = data?.leaderboard || [];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background" style={{ padding: "1.5vh 3vw 1vh" }}>

      {/* ── Period Tabs ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex justify-center shrink-0"
        style={{ marginBottom: "0.8vh" }}
      >
        <div className="bg-muted/40 backdrop-blur-md border border-border/80 rounded-full shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] relative" style={{ padding: "6px" }}>
          <div className="flex relative items-center">
            <motion.div
              className="absolute bg-gradient-to-b from-primary/90 to-primary rounded-full shadow-[0_2px_12px_rgba(255,255,255,0.15),_inset_0_1px_1px_rgba(255,255,255,0.8)] ring-1 ring-black/20"
              initial={false}
              animate={{ x: getPillX(selectedPeriod), width: getPillWidth(selectedPeriod) }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ height: `${PILL_HEIGHT}px`, top: "0px" }}
            />
            {PERIODS.map((p) => (
              <div
                key={p.key}
                className={`relative z-10 flex items-center justify-center font-semibold transition-all duration-200 ${
                  selectedPeriod === p.key
                    ? "text-primary-foreground drop-shadow-sm"
                    : "text-muted-foreground"
                }`}
                style={{ width: `${p.width}px`, height: `${PILL_HEIGHT}px`, fontSize: "clamp(0.9rem, 1.1vw, 1.2rem)" }}
              >
                {p.label}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Hero Amount ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="text-center shrink-0 relative"
        style={{ marginBottom: "1vh" }}
      >
        <div className="relative">
          <div
            className="font-black tracking-tighter leading-none number-flow-container [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]"
            style={{ fontSize: "clamp(6rem, 15vw, 14rem)", paddingBottom: "clamp(0.5rem, 1.5vh, 2rem)" }}
          >
            <NumberFlow
              value={totals.total_amount}
              format={{ style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }}
              locales="en-GB"
              transformTiming={{ duration: 600, easing: "ease-out" }}
              spinTiming={{ duration: 500, easing: "ease-out" }}
              opacityTiming={{ duration: 300, easing: "ease-out" }}
              willChange={false}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`subtitle-${selectedPeriod}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-muted-foreground relative z-10"
            style={{ fontSize: "clamp(1rem, 1.5vw, 1.6rem)", marginTop: "clamp(-2rem, -3vh, -1rem)" }}
          >
            {`${totals.total_deals} deal${totals.total_deals !== 1 ? "s" : ""} closed ${periodLabel(selectedPeriod)}`}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── Leaderboard & Deals ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="grid grid-cols-2 flex-1 min-h-0"
        style={{ gap: "clamp(12px, 1.5vw, 28px)" }}
      >
        {/* LEADERBOARD */}
        <div className="rounded-[24px] bg-card border border-border/40 shadow-soft overflow-hidden flex flex-col relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="flex items-center border-b border-border/40 bg-gradient-to-b from-muted/30 to-card relative z-10 shrink-0" style={{ padding: "clamp(12px, 1.5vh, 20px) clamp(16px, 1.5vw, 28px)" }}>
            <div className="flex items-center" style={{ gap: "clamp(8px, 0.8vw, 14px)" }}>
              <div
                className="relative flex items-center justify-center rounded-[10px] bg-gradient-to-b from-white to-gray-200 shadow-[0_2px_8px_rgba(255,255,255,0.3),_inset_0_-1px_1px_rgba(0,0,0,0.2)]"
                style={{ width: "clamp(26px, 1.8vw, 34px)", height: "clamp(26px, 1.8vw, 34px)" }}
              >
                <BarChartIcon
                  className="text-black drop-shadow-none"
                  style={{ width: "clamp(12px, 0.9vw, 16px)", height: "clamp(12px, 0.9vw, 16px)" }}
                />
              </div>
              <div>
                <h2
                  className="font-bold uppercase tracking-widest text-foreground"
                  style={{ fontSize: "clamp(0.7rem, 0.8vw, 0.95rem)" }}
                >
                  Leaderboard
                </h2>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`lb-period-${selectedPeriod}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.2 }}
                    className="font-medium text-muted-foreground"
                    style={{ fontSize: "clamp(0.6rem, 0.65vw, 0.8rem)", marginTop: "1px" }}
                  >
                    {periodLabel(selectedPeriod)}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 bg-card" style={{ padding: "clamp(8px, 0.6vw, 14px)" }}>
            <AnimatePresence mode="wait">
              {leaderboard.length === 0 ? (
                <motion.div
                  key="lb-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full text-muted-foreground"
                >
                  <div
                    className="flex items-center justify-center rounded-[16px] bg-muted/40 backdrop-blur-md border border-border/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] mb-4"
                    style={{ width: "clamp(48px, 3.5vw, 64px)", height: "clamp(48px, 3.5vw, 64px)" }}
                  >
                    <BarChartIcon className="text-muted-foreground/30" style={{ width: "clamp(20px, 1.5vw, 28px)", height: "clamp(20px, 1.5vw, 28px)" }} />
                  </div>
                  <p className="font-medium" style={{ fontSize: "clamp(0.8rem, 0.9vw, 1rem)" }}>
                    No deals closed {periodLabel(selectedPeriod)}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={`lb-${selectedPeriod}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {leaderboard.map((rep, index) => (
                    <LeaderboardRow key={rep.email || rep.name} rep={rep} index={index} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RECENT DEALS */}
        <div className="rounded-[24px] bg-card border border-border/40 shadow-soft overflow-hidden flex flex-col relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="flex items-center border-b border-border/40 bg-gradient-to-b from-muted/30 to-card relative z-10 shrink-0" style={{ padding: "clamp(12px, 1.5vh, 20px) clamp(16px, 1.5vw, 28px)" }}>
            <div className="flex items-center" style={{ gap: "clamp(8px, 0.8vw, 14px)" }}>
              <div
                className="relative flex items-center justify-center rounded-[10px] bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_2px_8px_rgba(16,185,129,0.4),_inset_0_1px_1px_rgba(255,255,255,0.5)]"
                style={{ width: "clamp(26px, 1.8vw, 34px)", height: "clamp(26px, 1.8vw, 34px)" }}
              >
                <img
                  src="/pounds-cropped.svg"
                  alt=""
                  className="drop-shadow-md brightness-0 invert"
                  style={{ width: "clamp(14px, 1vw, 18px)", height: "clamp(14px, 1vw, 18px)" }}
                />
              </div>
              <div>
                <h2
                  className="font-bold uppercase tracking-widest text-foreground"
                  style={{ fontSize: "clamp(0.7rem, 0.8vw, 0.95rem)" }}
                >
                  Recent Deals
                </h2>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`deals-period-${selectedPeriod}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.2 }}
                    className="font-medium text-muted-foreground"
                    style={{ fontSize: "clamp(0.6rem, 0.65vw, 0.8rem)", marginTop: "1px" }}
                  >
                    {periodLabel(selectedPeriod)}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 bg-card" style={{ padding: "clamp(8px, 0.6vw, 14px)" }}>
            <AnimatePresence mode="wait">
              {deals.length === 0 ? (
                <motion.div
                  key="deals-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full text-muted-foreground"
                >
                  <div
                    className="flex items-center justify-center rounded-[16px] bg-muted/40 backdrop-blur-md border border-border/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),_0_1px_1px_rgba(255,255,255,0.03)] mb-4"
                    style={{ width: "clamp(48px, 3.5vw, 64px)", height: "clamp(48px, 3.5vw, 64px)" }}
                  >
                    <img
                      src="/pounds-cropped.svg"
                      alt=""
                      className="invert-0 opacity-30"
                      style={{ width: "clamp(20px, 1.5vw, 28px)", height: "clamp(20px, 1.5vw, 28px)" }}
                    />
                  </div>
                  <p className="font-medium" style={{ fontSize: "clamp(0.8rem, 0.9vw, 1rem)" }}>
                    No deals closed {periodLabel(selectedPeriod)}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={`deals-${selectedPeriod}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {deals.map((deal, index) => (
                    <DealRow key={deal.Id} deal={deal} index={index} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ── Bottom Stats ── */}
      {allTotals && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="shrink-0"
          style={{ paddingTop: "1.2vh" }}
        >
          <div className="flex items-center justify-center border-t border-border/20" style={{ gap: "clamp(16px, 3vw, 48px)", paddingTop: "clamp(8px, 1vh, 16px)" }}>
            {PERIODS.filter((p) => p.key !== selectedPeriod).map((p) => {
              const t = allTotals[p.key];
              return (
                <div key={p.key} className="flex items-center text-muted-foreground/60" style={{ gap: "clamp(6px, 0.5vw, 10px)" }}>
                  <span
                    className="uppercase tracking-wider"
                    style={{ fontSize: "clamp(0.6rem, 0.7vw, 0.85rem)" }}
                  >
                    {p.label}
                  </span>
                  <span
                    className="font-semibold text-foreground/50 tabular-nums"
                    style={{ fontSize: "clamp(0.75rem, 0.9vw, 1.05rem)" }}
                  >
                    {formatCompact(t?.total_amount || 0)}
                  </span>
                  <span
                    className="text-muted-foreground/40 tabular-nums"
                    style={{ fontSize: "clamp(0.6rem, 0.65vw, 0.8rem)" }}
                  >
                    {t?.total_deals || 0} deals
                  </span>
                </div>
              );
            })}
            {totals.average_deal > 0 && (
              <div
                className="flex items-center text-muted-foreground/40 border-l border-border/20"
                style={{ gap: "clamp(4px, 0.4vw, 8px)", paddingLeft: "clamp(12px, 1.5vw, 24px)" }}
              >
                <TrendingUp style={{ width: "clamp(12px, 0.9vw, 16px)", height: "clamp(12px, 0.9vw, 16px)" }} />
                <span style={{ fontSize: "clamp(0.6rem, 0.7vw, 0.85rem)" }}>Avg deal</span>
                <span
                  className="font-semibold text-foreground/50 tabular-nums"
                  style={{ fontSize: "clamp(0.75rem, 0.9vw, 1.05rem)" }}
                >
                  {formatCompact(totals.average_deal)}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
