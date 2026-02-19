"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChartBar,
  UsersThree,
  Trophy,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { formatCurrency, EVENT_CATEGORY_COLORS } from "@/lib/constants";

// ── Types matching API response ──

interface ChannelAttribution {
  LeadSource: string;
  totalDeals: number;
  totalRevenue: number;
  avgDealSize: number;
}

interface RepPerformance {
  name: string;
  email: string;
  totalDeals: number;
  totalRevenue: number;
  avgDealSize: number;
  totalGuests: number;
}

interface EventPerformance {
  eventName: string;
  eventCategory: string | null;
  totalDeals: number;
  totalRevenue: number;
  totalGross: number;
}

interface AnalyticsData {
  channelAttribution: ChannelAttribution[];
  repPerformance: RepPerformance[];
  eventPerformance: EventPerformance[];
}

// ── Gradient bar colors per index ──

const BAR_GRADIENTS = [
  "from-blue-500 to-blue-400",
  "from-emerald-500 to-emerald-400",
  "from-violet-500 to-violet-400",
  "from-amber-500 to-amber-400",
  "from-rose-500 to-rose-400",
  "from-cyan-500 to-cyan-400",
  "from-pink-500 to-pink-400",
  "from-teal-500 to-teal-400",
  "from-orange-500 to-orange-400",
  "from-indigo-500 to-indigo-400",
];

function getBarGradient(index: number): string {
  return BAR_GRADIENTS[index % BAR_GRADIENTS.length];
}

// ── Category badge ──

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const key = category.toLowerCase().replace(/\s+/g, "-");
  const colors = EVENT_CATEGORY_COLORS[key] || {
    bg: "bg-zinc-500/15",
    text: "text-zinc-400",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text}`}
    >
      {category}
    </span>
  );
}

// ── Section wrapper ──

function Section({
  title,
  icon,
  subtitle,
  delay,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-foreground/[0.06]">
        {icon}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  );
}

// ── Main Component ──

export default function AnalyticsPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setDataLoading(true);
      else setIsRefreshing(true);
      setError(null);

      try {
        const res = await fetch("/api/analytics");
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        if (json.success) {
          setData(json.data as AnalyticsData);
        } else {
          throw new Error(json.error || "Unknown error");
        }
      } catch (err) {
        console.error("Analytics fetch error:", err);
        setError("Failed to load analytics data.");
      } finally {
        setDataLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  const channels = data?.channelAttribution || [];
  const reps = data?.repPerformance || [];
  const events = data?.eventPerformance || [];
  const maxChannelRevenue =
    channels.length > 0 ? Math.max(...channels.map((c) => c.totalRevenue)) : 1;
  const totalChannelRevenue = channels.reduce(
    (sum, c) => sum + c.totalRevenue,
    0
  );

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 pl-24 lg:p-8 lg:pl-24">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Performance Intelligence
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Year-to-date channel, rep, and event analytics
              </p>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08] transition-all disabled:opacity-50"
            >
              <ArrowsClockwise
                className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm"
            >
              {error}
              <button
                onClick={() => fetchData()}
                className="ml-3 underline hover:no-underline"
              >
                Retry
              </button>
            </motion.div>
          )}

          {dataLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] p-6 animate-pulse"
                >
                  <div className="h-5 w-48 bg-muted rounded mb-6" />
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="flex items-center gap-4">
                        <div className="h-4 w-24 bg-muted/60 rounded" />
                        <div className="flex-1 h-8 bg-muted/30 rounded-full" />
                        <div className="h-4 w-20 bg-muted/60 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Channel Attribution ── */}
              <Section
                title="Channel Attribution"
                icon={<ChartBar className="size-5 text-blue-400" weight="fill" />}
                subtitle={`${channels.length} sources - ${formatCurrency(totalChannelRevenue)} total`}
                delay={0.1}
              >
                <div className="space-y-4">
                  {channels.map((channel, i) => {
                    const pct =
                      maxChannelRevenue > 0
                        ? (channel.totalRevenue / maxChannelRevenue) * 100
                        : 0;
                    return (
                      <motion.div
                        key={channel.LeadSource}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.04 }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-medium truncate max-w-[200px]">
                              {channel.LeadSource}
                            </span>
                            <span className="text-xs text-muted-foreground/50 tabular-nums shrink-0">
                              {channel.totalDeals} deal{channel.totalDeals !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-xs text-muted-foreground/40 tabular-nums">
                              avg {formatCurrency(Math.round(channel.avgDealSize))}
                            </span>
                            <span className="text-sm font-bold tabular-nums w-24 text-right">
                              {formatCurrency(channel.totalRevenue)}
                            </span>
                          </div>
                        </div>
                        <div className="h-8 w-full rounded-full bg-foreground/[0.04] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              duration: 0.8,
                              delay: 0.2 + i * 0.04,
                              ease: "easeOut",
                            }}
                            className={`h-full rounded-full bg-gradient-to-r ${getBarGradient(i)} shadow-lg relative`}
                            style={{
                              minWidth: pct > 0 ? "24px" : "0",
                            }}
                          >
                            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/10 to-white/10" />
                          </motion.div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {channels.length === 0 && (
                    <p className="text-center text-muted-foreground/50 py-8 text-sm">
                      No channel attribution data available
                    </p>
                  )}
                </div>
              </Section>

              {/* ── Rep Performance ── */}
              <Section
                title="Rep Performance"
                icon={<UsersThree className="size-5 text-emerald-400" weight="fill" />}
                subtitle={`${reps.length} reps`}
                delay={0.2}
              >
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_110px_100px_80px] gap-4 px-4 pb-3 border-b border-foreground/[0.06] text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                  <span>Rep</span>
                  <span className="text-right">Deals</span>
                  <span className="text-right">Revenue</span>
                  <span className="text-right">Avg Deal</span>
                  <span className="text-right">Guests</span>
                </div>
                <div className="divide-y divide-foreground/[0.04]">
                  {reps.map((rep, i) => (
                    <motion.div
                      key={rep.email || rep.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.03 }}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_80px_110px_100px_80px] gap-2 sm:gap-4 px-4 py-3 hover:bg-foreground/[0.02] transition-colors rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank badge */}
                        <div
                          className={`flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 ${
                            i === 0
                              ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900"
                              : i === 1
                                ? "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700"
                                : i === 2
                                  ? "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100"
                                  : "bg-muted/60 text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </div>
                        <span className="text-sm font-medium truncate">
                          {rep.name}
                        </span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground/50 mr-2">
                          Deals:
                        </span>
                        <span className="text-sm tabular-nums">
                          {rep.totalDeals}
                        </span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground/50 mr-2">
                          Revenue:
                        </span>
                        <span className="text-sm font-bold tabular-nums text-emerald-400">
                          {formatCurrency(rep.totalRevenue)}
                        </span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground/50 mr-2">
                          Avg:
                        </span>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {formatCurrency(Math.round(rep.avgDealSize))}
                        </span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground/50 mr-2">
                          Guests:
                        </span>
                        <span className="text-sm tabular-nums text-muted-foreground/70">
                          {rep.totalGuests}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {reps.length === 0 && (
                    <p className="text-center text-muted-foreground/50 py-8 text-sm">
                      No rep performance data available
                    </p>
                  )}
                </div>
              </Section>

              {/* ── Event Performance ── */}
              <Section
                title="Event Performance"
                icon={<Trophy className="size-5 text-amber-400" weight="fill" />}
                subtitle={`${events.length} events`}
                delay={0.3}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {events.map((event, i) => (
                    <motion.div
                      key={event.eventName}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.35 + i * 0.03 }}
                      className="p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.05] hover:border-foreground/[0.10] transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="text-sm font-semibold truncate flex-1">
                          {event.eventName}
                        </h3>
                        <CategoryBadge category={event.eventCategory} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground/50">
                            Deals
                          </span>
                          <span className="text-sm tabular-nums font-medium">
                            {event.totalDeals}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground/50">
                            Net Revenue
                          </span>
                          <span className="text-sm tabular-nums font-medium">
                            {formatCurrency(event.totalRevenue)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-foreground/[0.04]">
                          <span className="text-xs text-muted-foreground/50">
                            Gross Revenue
                          </span>
                          <span className="text-sm tabular-nums font-bold text-emerald-400">
                            {formatCurrency(event.totalGross)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {events.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground/50 py-8 text-sm">
                      No event performance data available
                    </div>
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
