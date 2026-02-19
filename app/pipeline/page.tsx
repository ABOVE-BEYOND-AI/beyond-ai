"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Funnel,
  ArrowsClockwise,
  Users,
  Trophy,
  XCircle,
  CaretDown,
  DotOutline,
  User,
  CalendarBlank,
} from "@phosphor-icons/react";
import type { SalesforceOpportunityFull } from "@/lib/salesforce-types";
import {
  PIPELINE_STAGES,
  WON_STAGES,
  LOST_STAGES,
  OPPORTUNITY_STAGES,
  EVENT_CATEGORY_COLORS,
  formatCurrency,
  daysSince,
} from "@/lib/constants";

// ── Types ──

type PipelineStage = (typeof PIPELINE_STAGES)[number];

interface ColumnDef {
  stage: PipelineStage;
  label: string;
  iconColor: string;
  borderColor: string;
  glowColor: string;
}

const COLUMNS: ColumnDef[] = [
  {
    stage: "New",
    label: "New",
    iconColor: "text-blue-400",
    borderColor: "border-blue-500/30",
    glowColor: "ring-blue-500/40 bg-blue-500/5",
  },
  {
    stage: "Deposit Taken",
    label: "Deposit Taken",
    iconColor: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    glowColor: "ring-yellow-500/40 bg-yellow-500/5",
  },
  {
    stage: "Agreement Sent",
    label: "Agreement Sent",
    iconColor: "text-orange-400",
    borderColor: "border-orange-500/30",
    glowColor: "ring-orange-500/40 bg-orange-500/5",
  },
];

const POLL_INTERVAL_MS = 60_000;

// ── Helpers ──

function getCategoryColors(category: string | undefined | null): {
  bg: string;
  text: string;
} {
  if (!category) return { bg: "bg-muted/60", text: "text-muted-foreground" };
  const key = category.toLowerCase().replace(/\s+/g, "-");
  return (
    EVENT_CATEGORY_COLORS[key] || {
      bg: "bg-muted/60",
      text: "text-muted-foreground",
    }
  );
}

function healthColor(days: number): {
  dot: string;
  label: string;
  bg: string;
} {
  if (days <= 7)
    return {
      dot: "bg-green-500",
      label: "Healthy",
      bg: "bg-green-500/10",
    };
  if (days <= 14)
    return {
      dot: "bg-amber-500",
      label: "Aging",
      bg: "bg-amber-500/10",
    };
  return { dot: "bg-red-500", label: "Stale", bg: "bg-red-500/10" };
}

function sumAmount(opps: SalesforceOpportunityFull[]): number {
  return opps.reduce(
    (acc, o) => acc + (o.Gross_Amount__c ?? o.Amount ?? 0),
    0
  );
}

function uniqueOwners(opps: SalesforceOpportunityFull[]): string[] {
  const names = new Set<string>();
  for (const o of opps) {
    if (o.Owner?.Name) names.add(o.Owner.Name);
  }
  return Array.from(names).sort();
}

function uniqueEvents(
  opps: SalesforceOpportunityFull[]
): { name: string; id: string }[] {
  const map = new Map<string, string>();
  for (const o of opps) {
    if (o.Event__r?.Name && o.Event__c) {
      map.set(o.Event__c, o.Event__r.Name);
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Kanban Card ──

function KanbanCard({
  opp,
  onDragStart,
  onDragEnd,
}: {
  opp: SalesforceOpportunityFull;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  const amount = opp.Gross_Amount__c ?? opp.Amount ?? 0;
  const paidPct = opp.Percentage_Paid__c ?? 0;
  const days = daysSince(opp.LastModifiedDate);
  const health = healthColor(days);
  const catColors = getCategoryColors(opp.Event__r?.Category__c);
  const contactName =
    opp.Opportunity_Contact__r?.Name ?? opp.Account?.Name ?? "Unknown";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      draggable
      onDragStart={(e) =>
        onDragStart(e as unknown as React.DragEvent, opp.Id)
      }
      onDragEnd={onDragEnd}
      className="group cursor-grab active:cursor-grabbing rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 hover:border-border hover:shadow-lg hover:shadow-black/10 transition-all duration-200"
    >
      {/* Top: Event name + category badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-foreground leading-tight truncate flex-1">
          {opp.Event__r?.Name ?? opp.Name}
        </p>
        {opp.Event__r?.Category__c && (
          <span
            className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${catColors.bg} ${catColors.text}`}
          >
            {opp.Event__r.Category__c}
          </span>
        )}
      </div>

      {/* Contact / Account */}
      <div className="flex items-center gap-1.5 mb-3">
        <User className="size-3 text-muted-foreground/60" weight="bold" />
        <span className="text-xs text-muted-foreground truncate">
          {contactName}
        </span>
      </div>

      {/* Amount + Guests row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-bold tabular-nums text-foreground">
          {formatCurrency(amount)}
        </span>
        {opp.Total_Number_of_Guests__c != null &&
          opp.Total_Number_of_Guests__c > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="size-3" weight="bold" />
              {opp.Total_Number_of_Guests__c} guests
            </span>
          )}
      </div>

      {/* Payment progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            Paid
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Math.round(paidPct)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              paidPct >= 100
                ? "bg-green-500"
                : paidPct >= 50
                  ? "bg-blue-500"
                  : paidPct > 0
                    ? "bg-amber-500"
                    : "bg-muted-foreground/20"
            }`}
            style={{ width: `${Math.min(paidPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Days in stage + health indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`size-2 rounded-full ${health.dot}`}
            title={health.label}
          />
          <span className="text-[11px] text-muted-foreground">
            {days}d in stage
          </span>
        </div>
        {opp.Event__r?.Start_Date__c && (
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
            <CalendarBlank className="size-3" />
            {new Date(opp.Event__r.Start_Date__c).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>

      {/* Next step */}
      {opp.NextStep && (
        <p className="text-[11px] text-muted-foreground/80 italic truncate mb-2">
          Next: {opp.NextStep}
        </p>
      )}

      {/* Owner */}
      {opp.Owner?.Name && (
        <p className="text-[10px] text-muted-foreground/50 truncate">
          {opp.Owner.Name}
        </p>
      )}
    </motion.div>
  );
}

// ── Summary Stat Card ──

function StatCard({
  label,
  count,
  value,
  color,
  delay,
}: {
  label: string;
  count: number;
  value: number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <DotOutline className={`size-5 ${color}`} weight="fill" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">
        {formatCurrency(value)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {count} deal{count !== 1 ? "s" : ""}
      </p>
    </motion.div>
  );
}

// ── Select Dropdown ──

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-card/60 border border-border/50 rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ── Main Component ──

export default function PipelinePage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [opportunities, setOpportunities] = useState<
    SalesforceOpportunityFull[]
  >([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [ownerFilter, setOwnerFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");

  // Drag state
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);

  // ── Auth redirect ──
  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // ── Fetch data ──
  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
      if (silent) setIsRefreshing(true);
      setError(null);

      try {
        const response = await fetch("/api/pipeline?includeClosed=true");
        if (!response.ok) throw new Error("Failed to fetch pipeline");
        const result = await response.json();
        if (result.success) {
          setOpportunities(result.data);
          setLastUpdated(new Date());
          hasFetchedOnce.current = true;
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (err) {
        console.error("Pipeline fetch error:", err);
        if (!hasFetchedOnce.current)
          setError("Failed to load pipeline data. Check Salesforce connection.");
      } finally {
        setInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (user) fetchData(hasFetchedOnce.current);
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, fetchData]);

  // ── Drag and Drop handlers ──
  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, stage: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverColumn(stage);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, newStage: string) => {
      e.preventDefault();
      const oppId = e.dataTransfer.getData("text/plain");
      setDragOverColumn(null);

      if (!oppId) return;

      // Find the opp and check if the stage actually changed
      const opp = opportunities.find((o) => o.Id === oppId);
      if (!opp || opp.StageName === newStage) return;

      // Optimistic update
      setOpportunities((prev) =>
        prev.map((o) =>
          o.Id === oppId
            ? { ...o, StageName: newStage, LastModifiedDate: new Date().toISOString() }
            : o
        )
      );

      try {
        const res = await fetch("/api/pipeline", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: oppId, stage: newStage }),
        });
        if (!res.ok) {
          // Revert on failure
          setOpportunities((prev) =>
            prev.map((o) =>
              o.Id === oppId ? { ...o, StageName: opp.StageName, LastModifiedDate: opp.LastModifiedDate } : o
            )
          );
          console.error("Failed to update stage");
        }
      } catch {
        // Revert on error
        setOpportunities((prev) =>
          prev.map((o) =>
            o.Id === oppId ? { ...o, StageName: opp.StageName, LastModifiedDate: opp.LastModifiedDate } : o
          )
        );
        console.error("Failed to update stage");
      }
    },
    [opportunities]
  );

  const handleDragEnd = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  // ── Derived data ──
  const filtered = opportunities.filter((o) => {
    if (ownerFilter && o.Owner?.Name !== ownerFilter) return false;
    if (eventFilter && o.Event__c !== eventFilter) return false;
    return true;
  });

  const columns: Record<PipelineStage, SalesforceOpportunityFull[]> = {
    New: filtered.filter((o) => o.StageName === "New"),
    "Deposit Taken": filtered.filter((o) => o.StageName === "Deposit Taken"),
    "Agreement Sent": filtered.filter(
      (o) => o.StageName === "Agreement Sent"
    ),
  };

  const wonDeals = filtered.filter((o) =>
    (WON_STAGES as readonly string[]).includes(o.StageName)
  );
  const lostDeals = filtered.filter((o) =>
    (LOST_STAGES as readonly string[]).includes(o.StageName)
  );

  const totalPipeline = [
    ...columns["New"],
    ...columns["Deposit Taken"],
    ...columns["Agreement Sent"],
  ];

  const owners = uniqueOwners(opportunities);
  const events = uniqueEvents(opportunities);

  // ── Loading state ──
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
      <div className="min-h-dvh bg-gradient-to-br from-background to-muted/20 p-6 lg:p-8 pl-24">
        <div className="max-w-[1600px] mx-auto">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Pipeline
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Open opportunities across stages
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Filters */}
              <FilterSelect
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={owners.map((name) => ({ value: name, label: name }))}
                placeholder="All Owners"
              />
              <FilterSelect
                value={eventFilter}
                onChange={setEventFilter}
                options={events.map((e) => ({ value: e.id, label: e.name }))}
                placeholder="All Events"
              />

              {(ownerFilter || eventFilter) && (
                <button
                  onClick={() => {
                    setOwnerFilter("");
                    setEventFilter("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Clear filters
                </button>
              )}

              {/* Refresh */}
              <div className="flex items-center gap-2 pl-2 border-l border-border/30">
                {lastUpdated && (
                  <span className="text-xs text-muted-foreground/50">
                    {lastUpdated.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                <button
                  onClick={() => fetchData(true)}
                  disabled={isRefreshing}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                  aria-label="Refresh pipeline"
                >
                  <ArrowsClockwise
                    className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>
          </motion.div>

          {/* ── Error State ── */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => fetchData()}
                  className="mt-1 text-sm text-red-400/80 hover:text-red-400 underline"
                >
                  Try again
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Pipeline Summary Bar ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="New"
              count={columns["New"].length}
              value={sumAmount(columns["New"])}
              color="text-blue-400"
              delay={0.05}
            />
            <StatCard
              label="Deposit Taken"
              count={columns["Deposit Taken"].length}
              value={sumAmount(columns["Deposit Taken"])}
              color="text-yellow-400"
              delay={0.1}
            />
            <StatCard
              label="Agreement Sent"
              count={columns["Agreement Sent"].length}
              value={sumAmount(columns["Agreement Sent"])}
              color="text-orange-400"
              delay={0.15}
            />
            <StatCard
              label="Total Pipeline"
              count={totalPipeline.length}
              value={sumAmount(totalPipeline)}
              color="text-foreground"
              delay={0.2}
            />
          </div>

          {/* ── Kanban Board ── */}
          {initialLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map((col) => (
                <div
                  key={col}
                  className="rounded-xl border border-border/30 bg-card/30 p-4"
                >
                  <div className="animate-pulse bg-muted/50 h-6 w-32 rounded mb-4" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="animate-pulse bg-muted/30 h-40 rounded-xl"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {COLUMNS.map((col) => {
                const stageOpps = columns[col.stage];
                const stageTotal = sumAmount(stageOpps);
                const isOver = dragOverColumn === col.stage;
                const stageConfig = OPPORTUNITY_STAGES[col.stage];

                return (
                  <div
                    key={col.stage}
                    onDragOver={(e) => handleDragOver(e, col.stage)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.stage)}
                    className={`rounded-xl border transition-all duration-200 ${
                      isOver
                        ? `ring-2 ${col.glowColor} ${col.borderColor}`
                        : "border-border/30 bg-card/20"
                    }`}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{
                            backgroundColor: stageConfig?.color || "#888",
                          }}
                        />
                        <h3 className="text-sm font-semibold text-foreground">
                          {col.label}
                        </h3>
                        <span className="text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full tabular-nums">
                          {stageOpps.length}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium tabular-nums">
                        {formatCurrency(stageTotal)}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto scrollbar-hide">
                      <AnimatePresence mode="popLayout">
                        {stageOpps.length === 0 ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-12 text-muted-foreground/40"
                          >
                            <Funnel className="size-8 mb-2" />
                            <p className="text-xs">No deals</p>
                          </motion.div>
                        ) : (
                          stageOpps.map((opp) => (
                            <KanbanCard
                              key={opp.Id}
                              opp={opp}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                            />
                          ))
                        )}
                      </AnimatePresence>

                      {/* Drop indicator when dragging over empty area */}
                      {isOver && (
                        <div className="border-2 border-dashed border-primary/30 rounded-xl h-20 flex items-center justify-center">
                          <span className="text-xs text-primary/50">
                            Drop here
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Won & Lost Summary Panels ── */}
          {!initialLoading && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Won panel */}
              <div className="rounded-xl border border-green-500/20 bg-green-500/[0.03] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Trophy className="size-5 text-green-400" weight="fill" />
                  <h3 className="text-sm font-semibold text-green-400">
                    Won Deals
                  </h3>
                </div>
                <div className="flex items-baseline gap-4">
                  <p className="text-3xl font-bold tabular-nums text-green-400">
                    {formatCurrency(sumAmount(wonDeals))}
                  </p>
                  <p className="text-sm text-green-400/60">
                    {wonDeals.length} deal{wonDeals.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {wonDeals.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(WON_STAGES as readonly string[]).map((stage) => {
                      const count = wonDeals.filter(
                        (o) => o.StageName === stage
                      ).length;
                      if (count === 0) return null;
                      return (
                        <span
                          key={stage}
                          className="text-[10px] text-green-400/60 bg-green-500/10 px-2 py-0.5 rounded-full"
                        >
                          {stage}: {count}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lost panel */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <XCircle className="size-5 text-red-400" weight="fill" />
                  <h3 className="text-sm font-semibold text-red-400">
                    Lost Deals
                  </h3>
                </div>
                <div className="flex items-baseline gap-4">
                  <p className="text-3xl font-bold tabular-nums text-red-400">
                    {formatCurrency(sumAmount(lostDeals))}
                  </p>
                  <p className="text-sm text-red-400/60">
                    {lostDeals.length} deal{lostDeals.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {lostDeals.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(LOST_STAGES as readonly string[]).map((stage) => {
                      const count = lostDeals.filter(
                        (o) => o.StageName === stage
                      ).length;
                      if (count === 0) return null;
                      return (
                        <span
                          key={stage}
                          className="text-[10px] text-red-400/60 bg-red-500/10 px-2 py-0.5 rounded-full"
                        >
                          {stage}: {count}
                        </span>
                      );
                    })}
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
