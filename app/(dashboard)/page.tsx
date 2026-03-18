"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowUpRight, PhoneIncoming, PhoneOutgoing, MapPin, Calendar } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import NumberFlow from "@number-flow/react";
import { formatCurrency, daysUntil, EVENT_CATEGORY_COLORS, OPPORTUNITY_STAGES, PIPELINE_STAGES } from "@/lib/constants";
import { resolveEventImage } from "@/lib/event-images";
import type { SalesforceEvent, SalesforceOpportunityFull } from "@/lib/salesforce-types";

// ── Types ──

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

interface SalesData {
  period: string;
  totals: PeriodTotals;
  leaderboard: LeaderboardEntry[];
  all_totals: Record<string, PeriodTotals>;
}

interface CallStats {
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_duration: number;
  avg_duration: number;
}

interface CallListItem {
  id: number;
  direction: string;
  duration: number;
  started_at: number;
  status: string;
  agent_name: string;
  contact_name: string;
}

interface CallsData {
  stats: CallStats;
  recentCalls: CallListItem[];
}

interface OverdueSummary {
  totalOverdue: number;
  totalOutstanding: number;
  invoiceCount: number;
  agingBuckets: { label: string; count: number; total: number }[];
}

interface DashboardLead {
  Id: string;
  Name?: string;
  FirstName?: string;
  LastName?: string;
  Company?: string;
  Email?: string;
  Lead_Score__c?: number | null;
}

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  guests: number;
  start_date: string;
  end_date: string;
  status: "generating" | "generated" | "error";
  created_at: string;
}

// ── Animation Variants ──

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] as const } },
};

// ── Helpers ──

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatCallDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getCategoryColor(category: string | null) {
  if (!category) return { bg: "bg-muted", text: "text-muted-foreground" };
  const key = category.toLowerCase().replace(/_/g, " ").replace(/-/g, " ");
  return EVENT_CATEGORY_COLORS[key] || { bg: "bg-muted", text: "text-muted-foreground" };
}

// ── Quick Nav Items ──

type IconProps = React.SVGProps<SVGSVGElement>;

const navItems: { name: string; href: string; icon: (props: IconProps) => React.ReactNode; color: string }[] = [
  { name: "Leads", href: "/leads", color: "from-orange-500/10 to-orange-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { name: "Sales", href: "/sales", color: "from-green-500/10 to-green-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 7c0-1.1-.9-2-2-2h-3a3 3 0 0 0-3 3v8a3 3 0 0 1-3 3h12" /><path d="M6 13h8" /></svg> },
  { name: "Pipeline", href: "/pipeline", color: "from-blue-500/10 to-blue-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M8 4v16" /><path d="M16 4v16" /></svg> },
  { name: "Calls", href: "/calls", color: "from-violet-500/10 to-violet-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg> },
  { name: "Events", href: "/events", color: "from-pink-500/10 to-pink-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { name: "Clients", href: "/clients", color: "from-teal-500/10 to-teal-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { name: "Finance", href: "/finance", color: "from-amber-500/10 to-amber-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { name: "Analytics", href: "/analytics", color: "from-cyan-500/10 to-cyan-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg> },
  { name: "AI Chat", href: "/chat", color: "from-indigo-500/10 to-indigo-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M16 10h.01" /></svg> },
  { name: "Itinerary", href: "/itinerary", color: "from-rose-500/10 to-rose-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg> },
  { name: "Notes", href: "/notes", color: "from-slate-500/10 to-slate-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
  { name: "Outreach", href: "/outreach", color: "from-fuchsia-500/10 to-fuchsia-500/5", icon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg> },
];

// ── Skeleton Components ──

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="rounded-[20px] shadow-soft border-border/40">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-20 bg-muted/60 rounded" />
              <div className="h-8 w-24 bg-muted/60 rounded" />
              <div className="h-3 w-16 bg-muted/40 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SectionSkeleton({ cols = 2 }: { cols?: number }) {
  return (
    <div className={`grid grid-cols-1 ${cols === 2 ? "lg:grid-cols-2" : cols === 3 ? "md:grid-cols-3" : ""} gap-5`}>
      {Array.from({ length: cols }).map((_, i) => (
        <Card key={i} className="rounded-[20px] shadow-soft border-border/40">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-28 bg-muted/60 rounded" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-3 bg-muted/40 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Dashboard ──

export default function DashboardPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  // Data states
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [pipelineData, setPipelineData] = useState<SalesforceOpportunityFull[] | null>(null);
  const [callsData, setCallsData] = useState<CallsData | null>(null);
  const [financeData, setFinanceData] = useState<OverdueSummary | null>(null);
  const [leadsData, setLeadsData] = useState<DashboardLead[] | null>(null);
  const [eventsData, setEventsData] = useState<SalesforceEvent[] | null>(null);
  const [itinerariesData, setItinerariesData] = useState<Itinerary[] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [salesPeriod, setSalesPeriod] = useState<string>("month");

  // Auth redirect
  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // Data fetching
  const fetchDashboardData = useCallback(async () => {
    const results = await Promise.allSettled([
      fetch("/api/sales/data?period=month").then((r) => r.json()),
      fetch("/api/pipeline").then((r) => r.json()),
      fetch("/api/calls/data?period=today").then((r) => r.json()),
      fetch("/api/xero/overview").then((r) => r.json()),
      fetch("/api/leads?view=hot").then((r) => r.json()),
      fetch("/api/events/inventory").then((r) => r.json()),
      fetch("/api/itineraries?limit=5").then((r) => r.json()),
    ]);

    const [sales, pipeline, calls, finance, leads, events, itineraries] = results;

    if (sales.status === "fulfilled" && sales.value?.success) setSalesData(sales.value.data);
    if (pipeline.status === "fulfilled" && pipeline.value?.success) setPipelineData(pipeline.value.data);
    if (calls.status === "fulfilled" && calls.value?.success) setCallsData(calls.value.data);
    if (finance.status === "fulfilled" && finance.value?.success) setFinanceData(finance.value.data);
    if (leads.status === "fulfilled" && leads.value?.success) setLeadsData(leads.value.data);
    if (events.status === "fulfilled" && events.value?.success) setEventsData(events.value.data);
    if (itineraries.status === "fulfilled") {
      const iData = itineraries.value?.data || itineraries.value?.itineraries || itineraries.value;
      if (Array.isArray(iData)) setItinerariesData(iData);
    }

    setInitialLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 60_000);
      return () => clearInterval(interval);
    }
  }, [user, fetchDashboardData]);

  // Pipeline computed data
  const pipelineByStage = useMemo(() => {
    if (!pipelineData) return null;
    const stages: Record<string, { count: number; value: number }> = {};
    for (const stage of PIPELINE_STAGES) stages[stage] = { count: 0, value: 0 };
    for (const opp of pipelineData) {
      const s = opp.StageName;
      if (stages[s]) {
        stages[s].count++;
        stages[s].value += opp.Amount || 0;
      }
    }
    const total = Object.values(stages).reduce((sum, s) => sum + s.value, 0);
    return { stages, total, count: pipelineData.length };
  }, [pipelineData]);

  // Upcoming events
  const upcomingEvents = useMemo(() => {
    if (!eventsData) return null;
    const now = new Date().toISOString().slice(0, 10);
    return eventsData
      .filter((e) => e.Start_Date__c && e.Start_Date__c >= now)
      .sort((a, b) => (a.Start_Date__c || "").localeCompare(b.Start_Date__c || ""))
      .slice(0, 8);
  }, [eventsData]);

  // Current period totals for sales
  const currentTotals = useMemo(() => {
    if (!salesData?.all_totals) return null;
    return salesData.all_totals[salesPeriod] || salesData.totals;
  }, [salesData, salesPeriod]);

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

  const firstName = user.given_name || user.name?.split(" ")[0] || "there";

  return (
    <div className="p-6 lg:p-12 pl-24 lg:pl-28 max-w-[1440px] mx-auto space-y-8">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{formatDate()}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/itinerary">
              <Button size="sm" className="group rounded-full px-5 h-9 shadow-soft bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium">
                Create Itinerary
                <ArrowRight className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              </Button>
            </Link>
            <Link href="/leads">
              <Button size="sm" variant="outline" className="rounded-full px-5 h-9 text-xs font-medium border-border/60">
                New Lead
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="outline" className="rounded-full px-5 h-9 text-xs font-medium border-border/60">
                AI Chat
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Row ── */}
      {initialLoading ? (
        <KpiSkeleton />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Revenue */}
          <motion.div variants={item}>
            <Link href="/sales">
              <Card className="group rounded-[20px] shadow-soft border-border/40 hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer border-l-4 border-l-green-500 overflow-hidden">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Revenue (Month)</p>
                  <div className="text-2xl lg:text-3xl font-bold text-foreground tabular-nums tracking-tight">
                    {salesData ? <NumberFlow value={salesData.totals.total_amount} format={{ style: "currency", currency: "GBP", maximumFractionDigits: 0 }} transformTiming={{ duration: 600 }} /> : <span className="text-muted-foreground/50">--</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{salesData ? `${salesData.totals.total_deals} deals` : "--"}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Pipeline */}
          <motion.div variants={item}>
            <Link href="/pipeline">
              <Card className="group rounded-[20px] shadow-soft border-border/40 hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer border-l-4 border-l-blue-500 overflow-hidden">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Active Pipeline</p>
                  <div className="text-2xl lg:text-3xl font-bold text-foreground tabular-nums tracking-tight">
                    {pipelineByStage ? <NumberFlow value={pipelineByStage.count} transformTiming={{ duration: 600 }} /> : <span className="text-muted-foreground/50">--</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{pipelineByStage ? formatCurrency(pipelineByStage.total) + " value" : "--"}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Calls */}
          <motion.div variants={item}>
            <Link href="/calls">
              <Card className="group rounded-[20px] shadow-soft border-border/40 hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer border-l-4 border-l-violet-500 overflow-hidden">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Calls Today</p>
                  <div className="text-2xl lg:text-3xl font-bold text-foreground tabular-nums tracking-tight">
                    {callsData ? <NumberFlow value={callsData.stats.total_calls} transformTiming={{ duration: 600 }} /> : <span className="text-muted-foreground/50">--</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{callsData ? `${callsData.stats.answered_calls} answered` : "--"}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Overdue Invoices */}
          <motion.div variants={item}>
            <Link href="/finance">
              <Card className="group rounded-[20px] shadow-soft border-border/40 hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer border-l-4 border-l-amber-500 overflow-hidden">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Overdue Invoices</p>
                  <div className="text-2xl lg:text-3xl font-bold text-foreground tabular-nums tracking-tight">
                    {financeData ? <NumberFlow value={financeData.invoiceCount} transformTiming={{ duration: 600 }} /> : <span className="text-muted-foreground/50">--</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{financeData ? formatCurrency(financeData.totalOverdue) + " overdue" : "--"}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Hot Leads */}
          <motion.div variants={item}>
            <Link href="/leads">
              <Card className="group rounded-[20px] shadow-soft border-border/40 hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer border-l-4 border-l-orange-500 overflow-hidden">
                <CardContent className="p-5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Hot Leads</p>
                  <div className="text-2xl lg:text-3xl font-bold text-foreground tabular-nums tracking-tight">
                    {leadsData ? <NumberFlow value={leadsData.length} transformTiming={{ duration: 600 }} /> : <span className="text-muted-foreground/50">--</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">ready to convert</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </motion.div>
      )}

      {/* ── Sales & Pipeline ── */}
      {initialLoading ? (
        <SectionSkeleton cols={2} />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Revenue Summary */}
          <motion.div variants={item}>
            <Card className="rounded-[20px] shadow-soft border-border/40 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-foreground">Revenue</h2>
                  <div className="flex gap-1">
                    {(["today", "week", "month", "year"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSalesPeriod(p)}
                        className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                          salesPeriod === p
                            ? "bg-foreground text-background shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {currentTotals ? (
                  <div className="space-y-5">
                    <div>
                      <div className="text-3xl font-bold tracking-tight tabular-nums">
                        <NumberFlow value={currentTotals.total_amount} format={{ style: "currency", currency: "GBP", maximumFractionDigits: 0 }} transformTiming={{ duration: 500 }} />
                      </div>
                      <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span>{currentTotals.total_deals} deals</span>
                        <span>avg {formatCurrency(currentTotals.average_deal)}</span>
                      </div>
                    </div>

                    {/* Leaderboard */}
                    {salesData?.leaderboard && salesData.leaderboard.length > 0 && (
                      <div className="space-y-2.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Top Performers</p>
                        {salesData.leaderboard.slice(0, 3).map((rep, i) => (
                          <div key={rep.email || i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                i === 0 ? "bg-amber-500/15 text-amber-500" : i === 1 ? "bg-slate-400/15 text-slate-400" : "bg-orange-700/15 text-orange-700"
                              }`}>
                                {i + 1}
                              </div>
                              <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{rep.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold tabular-nums">{formatCurrency(rep.total_amount)}</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">{rep.deal_count}d</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Unable to load sales data</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Pipeline Snapshot */}
          <motion.div variants={item}>
            <Card className="rounded-[20px] shadow-soft border-border/40 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-foreground">Pipeline</h2>
                  <Link href="/pipeline" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    View all <ArrowUpRight className="size-3" />
                  </Link>
                </div>

                {pipelineByStage ? (
                  <div className="space-y-4">
                    {PIPELINE_STAGES.map((stage) => {
                      const data = pipelineByStage.stages[stage];
                      const pct = pipelineByStage.total > 0 ? (data.value / pipelineByStage.total) * 100 : 0;
                      const stageConfig = OPPORTUNITY_STAGES[stage];
                      return (
                        <div key={stage} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="size-2 rounded-full" style={{ backgroundColor: stageConfig?.color || "#888" }} />
                              <span className="text-sm font-medium">{stage}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold tabular-nums">{formatCurrency(data.value)}</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">{data.count} deals</span>
                            </div>
                          </div>
                          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(pct, 2)}%` }}
                              transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: stageConfig?.color || "#888" }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Total pipeline</span>
                      <span className="text-sm font-bold tabular-nums">{formatCurrency(pipelineByStage.total)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Unable to load pipeline data</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ── Upcoming Events ── */}
      {initialLoading ? (
        <div>
          <div className="h-4 w-32 bg-muted/50 rounded mb-4 animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[280px] h-[200px] bg-muted/30 rounded-[20px] animate-pulse" />
            ))}
          </div>
        </div>
      ) : upcomingEvents && upcomingEvents.length > 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Upcoming Events</h2>
            <Link href="/events" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
            {upcomingEvents.map((event) => {
              const img = resolveEventImage(event.Name);
              const days = daysUntil(event.Start_Date__c);
              const catColor = getCategoryColor(event.Category__c);
              return (
                <Link key={event.Id} href="/events" className="flex-shrink-0 w-[280px] group">
                  <Card className="rounded-[20px] shadow-soft border-border/40 overflow-hidden hover:shadow-md hover:border-primary/20 transition-all duration-300 h-full">
                    <div className="relative h-[130px] bg-muted/30 overflow-hidden">
                      {img ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={img}
                          alt={event.Name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Calendar className="size-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      {days !== null && days >= 0 && (
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white">
                          {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                        </div>
                      )}
                      <div className="absolute bottom-2.5 left-3 right-3">
                        <p className="text-white text-sm font-semibold truncate drop-shadow-sm">{event.Name}</p>
                      </div>
                    </div>
                    <CardContent className="p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Calendar className="size-3" />
                          <span>{event.Start_Date__c ? new Date(event.Start_Date__c).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "--"}</span>
                        </div>
                        {event.Category__c && (
                          <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${catColor.bg} ${catColor.text}`}>
                            {event.Category__c.replace(/_/g, " ").replace(/-/g, " ")}
                          </span>
                        )}
                      </div>
                      {event.Location__r?.Name && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1.5">
                          <MapPin className="size-3" />
                          <span className="truncate">{event.Location__r.Name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </motion.div>
      ) : null}

      {/* ── Recent Activity ── */}
      {initialLoading ? (
        <SectionSkeleton cols={3} />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Recent Itineraries */}
          <motion.div variants={item}>
            <Card className="rounded-[20px] shadow-soft border-border/40 overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Recent Itineraries</h3>
                  <Link href="/itineraries" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    View all <ArrowUpRight className="size-3" />
                  </Link>
                </div>
                {itinerariesData && itinerariesData.length > 0 ? (
                  <div className="space-y-3">
                    {itinerariesData.slice(0, 4).map((it) => (
                      <Link key={it.id} href={`/itinerary/${it.id}`} className="block group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {it.destination || it.title || "Untitled"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {it.start_date ? new Date(it.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "--"}
                              {it.guests ? ` · ${it.guests} guests` : ""}
                            </p>
                          </div>
                          <span className={`flex-shrink-0 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            it.status === "generated" ? "bg-green-500/15 text-green-500" :
                            it.status === "generating" ? "bg-blue-500/15 text-blue-500" :
                            "bg-red-500/15 text-red-500"
                          }`}>
                            {it.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">No itineraries yet</p>
                    <Link href="/itinerary" className="text-xs text-primary hover:underline mt-1 inline-block">Create one</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Hot Leads */}
          <motion.div variants={item}>
            <Card className="rounded-[20px] shadow-soft border-border/40 overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Hot Leads</h3>
                  <Link href="/leads" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    View all <ArrowUpRight className="size-3" />
                  </Link>
                </div>
                {leadsData && leadsData.length > 0 ? (
                  <div className="space-y-3">
                    {leadsData.slice(0, 5).map((lead) => (
                      <Link key={lead.Id} href="/leads" className="block group">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {lead.Name || `${lead.FirstName || ""} ${lead.LastName || ""}`.trim()}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{lead.Company || lead.Email || "--"}</p>
                          </div>
                          {lead.Lead_Score__c != null && (
                            <div className={`flex-shrink-0 text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${
                              lead.Lead_Score__c >= 70 ? "bg-green-500/15 text-green-500" :
                              lead.Lead_Score__c >= 40 ? "bg-amber-500/15 text-amber-500" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {lead.Lead_Score__c}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No hot leads</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Calls */}
          <motion.div variants={item}>
            <Card className="rounded-[20px] shadow-soft border-border/40 overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Recent Calls</h3>
                  <Link href="/calls" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    View all <ArrowUpRight className="size-3" />
                  </Link>
                </div>
                {callsData?.recentCalls && callsData.recentCalls.length > 0 ? (
                  <div className="space-y-3">
                    {callsData.recentCalls.slice(0, 5).map((call) => (
                      <div key={call.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            call.direction === "inbound" ? "bg-blue-500/15" : "bg-green-500/15"
                          }`}>
                            {call.direction === "inbound" ? (
                              <PhoneIncoming className="size-3 text-blue-500" />
                            ) : (
                              <PhoneOutgoing className="size-3 text-green-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{call.contact_name || call.agent_name || "Unknown"}</p>
                            <p className="text-[11px] text-muted-foreground">{call.agent_name}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] font-medium tabular-nums text-muted-foreground">{formatCallDuration(call.duration)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No calls yet today</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ── Quick Navigation ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <h2 className="text-sm font-semibold text-foreground mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {navItems.map((nav) => (
            <Link key={nav.name} href={nav.href}>
              <Card className="group rounded-[16px] border-border/40 bg-card shadow-soft hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer overflow-hidden">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2.5">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${nav.color} transition-transform duration-300 group-hover:scale-110`}>
                    <nav.icon className="size-5 text-foreground/70" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">{nav.name}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
