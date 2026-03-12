"use client";

import { useEffect, useState, useRef, useMemo } from "react";

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

const PERIODS: SalesPeriod[] = ["today", "week", "month", "year"];
const PERIOD_LABELS: Record<SalesPeriod, string> = {
  today: "Today", week: "Week", month: "Month", year: "Year",
};
const PERIOD_SUBLABELS: Record<SalesPeriod, string> = {
  today: "today", week: "this week", month: "this month", year: "this year",
};

const POLL_MS = 30_000;
const CYCLE_MS = 15_000;

// ── Helpers ──

const fmtCurrency = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCompact = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function clientName(name: string) {
  return name.split(" - ")[0] || name;
}

// ── Tiny SVG icons (inline, no library) ──

function BarChartIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20V14" />
    </svg>
  );
}

function TrendUpIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

// ── Static Row Components (zero animation, zero overhead) ──

function LeaderboardRow({ rep, index }: { rep: LeaderboardEntry; index: number }) {
  const isTop = index < 3;
  const rankBg = index === 0
    ? "bg-foreground/10 text-foreground border-border/60"
    : index === 1
    ? "bg-muted/60 text-foreground/80 border-border/50"
    : index === 2
    ? "bg-muted/40 text-foreground/70 border-border/40"
    : "bg-muted/30 text-muted-foreground border-border/30";
  const rowBg = index === 0
    ? "bg-foreground/[0.05] border-border/60"
    : index === 1
    ? "bg-muted/20 border-border/20"
    : index === 2
    ? "bg-muted/10 border-border/10"
    : "border-transparent";

  return (
    <div
      className={`flex items-center gap-[1.2vw] rounded-2xl border ${rowBg}`}
      style={{ padding: "clamp(10px, 1.2vh, 18px) clamp(12px, 1vw, 20px)", marginBottom: "clamp(4px, 0.5vh, 8px)" }}
    >
      <div
        className={`flex items-center justify-center rounded-[12px] font-bold shrink-0 border ${rankBg}`}
        style={{ width: "clamp(40px, 3vw, 56px)", height: "clamp(40px, 3vw, 56px)", fontSize: "clamp(0.85rem, 1vw, 1.2rem)" }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`tracking-tight truncate ${isTop ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}
          style={{ fontSize: isTop ? "clamp(0.95rem, 1.2vw, 1.4rem)" : "clamp(0.85rem, 1vw, 1.2rem)" }}
        >
          {rep.name}
        </p>
        <p className="text-muted-foreground flex items-center gap-1.5" style={{ fontSize: "clamp(0.65rem, 0.7vw, 0.85rem)", marginTop: "2px" }}>
          <span className="inline-block rounded-full bg-primary/20" style={{ width: 5, height: 5 }} />
          {rep.deal_count} deal{rep.deal_count !== 1 ? "s" : ""}
        </p>
      </div>
      <p
        className={`tabular-nums shrink-0 tracking-tight ${isTop ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}
        style={{ fontSize: isTop ? "clamp(1rem, 1.3vw, 1.6rem)" : "clamp(0.85rem, 1.05vw, 1.25rem)" }}
      >
        {fmtCurrency(rep.total_amount)}
      </p>
    </div>
  );
}

function DealRow({ deal }: { deal: SalesforceOpportunity }) {
  const amount = deal.Amount ?? deal.Gross_Amount__c ?? 0;
  const owner = deal.Owner?.Name || "Unknown";
  const event = deal.Event__r?.Name;

  return (
    <div
      className="flex items-center gap-[1.2vw] bg-card border border-border/40 rounded-2xl overflow-hidden"
      style={{ padding: "clamp(10px, 1.2vh, 18px) clamp(12px, 1vw, 20px)", marginBottom: "clamp(4px, 0.5vh, 8px)" }}
    >
      <div
        className="flex items-center justify-center shrink-0 rounded-[12px] bg-muted/60 border border-border/60"
        style={{ width: "clamp(40px, 3vw, 56px)", height: "clamp(40px, 3vw, 56px)" }}
      >
        <img src="/pounds-cropped.svg" alt="" className="invert-0 opacity-40" style={{ width: "clamp(14px, 1.1vw, 20px)", height: "clamp(14px, 1.1vw, 20px)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold tracking-tight truncate text-foreground/90" style={{ fontSize: "clamp(0.85rem, 1.05vw, 1.2rem)" }}>
          {clientName(deal.Name)}
        </p>
        <div className="flex items-center gap-2" style={{ marginTop: "2px", fontSize: "clamp(0.65rem, 0.7vw, 0.85rem)" }}>
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="rounded-full bg-muted-foreground/30" style={{ width: 5, height: 5, display: "inline-block" }} />
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
      <p className="font-bold tabular-nums shrink-0 tracking-tight text-foreground/90" style={{ fontSize: "clamp(0.95rem, 1.15vw, 1.4rem)" }}>
        {fmtCurrency(amount)}
      </p>
    </div>
  );
}

// ── Main Component ──

export default function TVSalesClient({ initialData }: { initialData: DashboardResponse | null }) {
  const [data, setData] = useState<DashboardResponse | null>(initialData);
  const [displayPeriod, setDisplayPeriod] = useState<SalesPeriod>("month");
  const [contentVisible, setContentVisible] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const cycleRef = useRef<ReturnType<typeof setInterval>>(undefined);
  // Track which period to fetch next — rotates independently of display
  const fetchPeriodRef = useRef<SalesPeriod>("month");

  // Force dark mode once
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Poll API every 30s — always fetches the CURRENT display period for fresh deals/leaderboard
  useEffect(() => {
    const doFetch = async () => {
      try {
        const res = await fetch(`/api/sales/data?period=${fetchPeriodRef.current}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch {}
    };

    // Initial fetch already done server-side via initialData, just start polling
    pollRef.current = setInterval(doFetch, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []); // No deps — never re-creates

  // Auto-cycle display period every 15s with a brief fade
  useEffect(() => {
    cycleRef.current = setInterval(() => {
      // Fade out
      setContentVisible(false);

      // After fade-out, switch period + fade in
      setTimeout(() => {
        setDisplayPeriod(prev => {
          const next = PERIODS[(PERIODS.indexOf(prev) + 1) % PERIODS.length];
          fetchPeriodRef.current = next; // Next poll will fetch this period's deals
          return next;
        });
        setContentVisible(true);
      }, 200);
    }, CYCLE_MS);
    return () => clearInterval(cycleRef.current);
  }, []);

  // ── Derived values ──
  const allTotals = data?.all_totals;
  const totals = useMemo<PeriodTotals>(
    () => allTotals?.[displayPeriod] || { total_amount: 0, total_deals: 0, average_deal: 0 },
    [allTotals, displayPeriod]
  );
  const deals = data?.deals || [];
  const leaderboard = data?.leaderboard || [];

  // ── Pill position (CSS calc, no spring physics) ──
  const pillWidths = [110, 100, 120, 100];
  const pillIdx = PERIODS.indexOf(displayPeriod);
  const pillX = pillWidths.slice(0, pillIdx).reduce((a, b) => a + b, 0);
  const pillW = pillWidths[pillIdx];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background" style={{ padding: "1.5vh 3vw 1vh" }}>

      {/* ── Period Tabs ── */}
      <div className="flex justify-center shrink-0" style={{ marginBottom: "0.8vh" }}>
        <div className="bg-muted/80 border border-border/60 rounded-full shadow-sm relative" style={{ padding: 6 }}>
          <div className="flex relative items-center">
            {/* Animated pill — CSS transition only */}
            <div
              className="absolute bg-primary rounded-full shadow-md ring-1 ring-black/20"
              style={{
                height: 44,
                top: 0,
                left: pillX,
                width: pillW,
                transition: "left 0.4s cubic-bezier(0.4, 0, 0.2, 1), width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            {PERIODS.map((p, i) => (
              <div
                key={p}
                className={`relative z-10 flex items-center justify-center font-semibold ${
                  displayPeriod === p ? "text-primary-foreground" : "text-muted-foreground"
                }`}
                style={{
                  width: pillWidths[i],
                  height: 44,
                  fontSize: "clamp(0.9rem, 1.1vw, 1.2rem)",
                  transition: "color 0.2s",
                }}
              >
                {PERIOD_LABELS[p]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hero Amount — static text, CSS fade ── */}
      <div className="text-center shrink-0" style={{ marginBottom: "2vh" }}>
        <div
          className="font-black tracking-tighter leading-none text-foreground tabular-nums"
          style={{
            fontSize: "clamp(6rem, 15vw, 14rem)",
            paddingBottom: "clamp(0.5rem, 1.5vh, 2rem)",
            opacity: contentVisible ? 1 : 0,
            transition: "opacity 0.2s ease-out",
            maskImage: "linear-gradient(to bottom, white 60%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, white 60%, transparent 100%)",
          }}
        >
          {fmtCurrency(totals.total_amount)}
        </div>
        <p
          className="text-muted-foreground"
          style={{
            fontSize: "clamp(1rem, 1.5vw, 1.6rem)",
            marginTop: "clamp(-2rem, -3vh, -1rem)",
            opacity: contentVisible ? 1 : 0,
            transition: "opacity 0.2s ease-out",
          }}
        >
          {totals.total_deals} deal{totals.total_deals !== 1 ? "s" : ""} closed {PERIOD_SUBLABELS[displayPeriod]}
        </p>
      </div>

      {/* ── Panels ── */}
      <div
        className="grid grid-cols-2 flex-1 min-h-0"
        style={{
          gap: "clamp(12px, 1.5vw, 28px)",
          opacity: contentVisible ? 1 : 0,
          transition: "opacity 0.2s ease-out",
        }}
      >
        {/* LEADERBOARD */}
        <div className="rounded-[24px] bg-card border border-border/40 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center border-b border-border/40 bg-muted/20 shrink-0" style={{ padding: "clamp(12px, 1.5vh, 20px) clamp(16px, 1.5vw, 28px)" }}>
            <div className="flex items-center" style={{ gap: "clamp(8px, 0.8vw, 14px)" }}>
              <div
                className="flex items-center justify-center rounded-[10px] bg-gradient-to-b from-white to-gray-200 shadow-sm"
                style={{ width: "clamp(26px, 1.8vw, 34px)", height: "clamp(26px, 1.8vw, 34px)" }}
              >
                <BarChartIcon size={14} />
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-widest text-foreground" style={{ fontSize: "clamp(0.7rem, 0.8vw, 0.95rem)" }}>
                  Leaderboard
                </h2>
                <p className="font-medium text-muted-foreground" style={{ fontSize: "clamp(0.6rem, 0.65vw, 0.8rem)", marginTop: 1 }}>
                  {PERIOD_SUBLABELS[displayPeriod]}
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide bg-card" style={{ padding: "clamp(8px, 0.6vw, 14px)" }}>
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div
                  className="flex items-center justify-center rounded-[16px] bg-muted/60 border border-border/60 mb-4"
                  style={{ width: "clamp(48px, 3.5vw, 64px)", height: "clamp(48px, 3.5vw, 64px)" }}
                >
                  <BarChartIcon size={24} />
                </div>
                <p className="font-medium" style={{ fontSize: "clamp(0.8rem, 0.9vw, 1rem)" }}>
                  No deals closed {PERIOD_SUBLABELS[displayPeriod]}
                </p>
              </div>
            ) : (
              leaderboard.map((rep, i) => (
                <LeaderboardRow key={rep.email || rep.name} rep={rep} index={i} />
              ))
            )}
          </div>
        </div>

        {/* RECENT DEALS */}
        <div className="rounded-[24px] bg-card border border-border/40 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center border-b border-border/40 bg-muted/20 shrink-0" style={{ padding: "clamp(12px, 1.5vh, 20px) clamp(16px, 1.5vw, 28px)" }}>
            <div className="flex items-center" style={{ gap: "clamp(8px, 0.8vw, 14px)" }}>
              <div
                className="flex items-center justify-center rounded-[10px] bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-sm"
                style={{ width: "clamp(26px, 1.8vw, 34px)", height: "clamp(26px, 1.8vw, 34px)" }}
              >
                <img src="/pounds-cropped.svg" alt="" className="brightness-0 invert" style={{ width: "clamp(14px, 1vw, 18px)", height: "clamp(14px, 1vw, 18px)" }} />
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-widest text-foreground" style={{ fontSize: "clamp(0.7rem, 0.8vw, 0.95rem)" }}>
                  Recent Deals
                </h2>
                <p className="font-medium text-muted-foreground" style={{ fontSize: "clamp(0.6rem, 0.65vw, 0.8rem)", marginTop: 1 }}>
                  {PERIOD_SUBLABELS[displayPeriod]}
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide bg-card" style={{ padding: "clamp(8px, 0.6vw, 14px)" }}>
            {deals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div
                  className="flex items-center justify-center rounded-[16px] bg-muted/60 border border-border/60 mb-4"
                  style={{ width: "clamp(48px, 3.5vw, 64px)", height: "clamp(48px, 3.5vw, 64px)" }}
                >
                  <img src="/pounds-cropped.svg" alt="" className="invert-0 opacity-30" style={{ width: "clamp(20px, 1.5vw, 28px)", height: "clamp(20px, 1.5vw, 28px)" }} />
                </div>
                <p className="font-medium" style={{ fontSize: "clamp(0.8rem, 0.9vw, 1rem)" }}>
                  No deals closed {PERIOD_SUBLABELS[displayPeriod]}
                </p>
              </div>
            ) : (
              deals.map((deal) => (
                <DealRow key={deal.Id} deal={deal} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Stats ── */}
      {allTotals && (
        <div className="shrink-0" style={{ paddingTop: "1.2vh" }}>
          <div className="flex items-center justify-center border-t border-border/20" style={{ gap: "clamp(16px, 3vw, 48px)", paddingTop: "clamp(8px, 1vh, 16px)" }}>
            {PERIODS.filter(p => p !== displayPeriod).map(p => {
              const t = allTotals[p];
              return (
                <div key={p} className="flex items-center text-muted-foreground/60" style={{ gap: "clamp(6px, 0.5vw, 10px)" }}>
                  <span className="uppercase tracking-wider" style={{ fontSize: "clamp(0.6rem, 0.7vw, 0.85rem)" }}>
                    {PERIOD_LABELS[p]}
                  </span>
                  <span className="font-semibold text-foreground/50 tabular-nums" style={{ fontSize: "clamp(0.75rem, 0.9vw, 1.05rem)" }}>
                    {fmtCompact(t?.total_amount || 0)}
                  </span>
                  <span className="text-muted-foreground/40 tabular-nums" style={{ fontSize: "clamp(0.6rem, 0.65vw, 0.8rem)" }}>
                    {t?.total_deals || 0} deals
                  </span>
                </div>
              );
            })}
            {totals.average_deal > 0 && (
              <div className="flex items-center text-muted-foreground/40 border-l border-border/20" style={{ gap: "clamp(4px, 0.4vw, 8px)", paddingLeft: "clamp(12px, 1.5vw, 24px)" }}>
                <TrendUpIcon size={14} />
                <span style={{ fontSize: "clamp(0.6rem, 0.7vw, 0.85rem)" }}>Avg deal</span>
                <span className="font-semibold text-foreground/50 tabular-nums" style={{ fontSize: "clamp(0.75rem, 0.9vw, 1.05rem)" }}>
                  {fmtCompact(totals.average_deal)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
