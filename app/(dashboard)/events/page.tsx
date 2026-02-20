"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarBlank,
  MapPin,
  CurrencyGbp,
  Warning,
  Package,
  Bed,
  AirplaneTakeoff,
  AirplaneLanding,
  Car,
  ForkKnife,
  Martini,
  Confetti,
  Ticket,
  UserCircle,
  MagnifyingGlass,
  X,
  ArrowLeft,
  ArrowRight,
  CaretRight,
  Users,
  ChartLineUp,
  Clock,
  ArrowsClockwise,
  CheckCircle,
  CaretDown,
  Funnel,
} from "@phosphor-icons/react";
import type {
  SalesforceEvent,
  SalesforceOpportunityFull,
} from "@/lib/salesforce-types";
import {
  formatCurrency,
  daysUntil,
  EVENT_CATEGORY_COLORS,
  OPPORTUNITY_STAGES,
} from "@/lib/constants";

// ── Helpers ──

function getCatStyle(category: string | null) {
  if (!category) return { bg: "bg-muted/15", text: "text-muted-foreground" };
  const key = category.toLowerCase().replace(/\s+/g, "-");
  return (
    EVENT_CATEGORY_COLORS[key] ||
    EVENT_CATEGORY_COLORS[category.toLowerCase()] || {
      bg: "bg-muted/15",
      text: "text-muted-foreground",
    }
  );
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  if (!e || s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString("en-GB", opts);
  }
  // Same month
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.toLocaleDateString("en-GB", opts)}`;
  }
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", opts)}`;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  // Salesforce time format: "HH:mm:ss.000Z"
  const parts = time.split(":");
  return `${parts[0]}:${parts[1]}`;
}

// ── Ticket Types ──

const TICKET_TYPES = [
  {
    label: "Event",
    icon: Ticket,
    requiredField: "Event_Tickets_Required__c",
    bookedField: "Event_Tickets_Booked__c",
  },
  {
    label: "Hospitality",
    icon: Package,
    requiredField: "Hospitality_Tickets_Required__c",
    bookedField: "Hospitality_Tickets_Booked__c",
  },
  {
    label: "Hotel",
    icon: Bed,
    requiredField: "Hotel_Tickets_Required__c",
    bookedField: "Hotel_Tickets_Booked__c",
  },
  {
    label: "Dinner",
    icon: ForkKnife,
    requiredField: "Dinner_Tickets_Required__c",
    bookedField: "Dinner_Tickets_Booked__c",
  },
  {
    label: "Drinks",
    icon: Martini,
    requiredField: "Drinks_Tickets_Required__c",
    bookedField: "Drinks_Tickets_Booked__c",
  },
  {
    label: "Party",
    icon: Confetti,
    requiredField: "Party_Tickets_Required__c",
    bookedField: "Party_Tickets_Booked__c",
  },
  {
    label: "Flights In",
    icon: AirplaneLanding,
    requiredField: "Inbound_Flight_Tickets_Required__c",
    bookedField: "Inbound_Flight_Tickets_Booked__c",
  },
  {
    label: "Flights Out",
    icon: AirplaneTakeoff,
    requiredField: "Outbound_Flight_Tickets_Required__c",
    bookedField: "Outbound_Flight_Tickets_Booked__c",
  },
  {
    label: "Transfers In",
    icon: Car,
    requiredField: "Inbound_Transfer_Tickets_Required__c",
    bookedField: "Inbound_Transfer_Tickets_Booked__c",
  },
  {
    label: "Transfers Out",
    icon: Car,
    requiredField: "Outbound_Transfer_Tickets_Required__c",
    bookedField: "Outbound_Transfer_Tickets_Booked__c",
  },
] as const;

// ── Ticket Bar Sub-component ──

function TicketBar({
  label,
  icon: Icon,
  required,
  booked,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  required: number;
  booked: number;
}) {
  if (required === 0) return null;
  const pct = Math.min(100, Math.round((booked / required) * 100));
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span className="w-20 truncate text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-14 text-right tabular-nums text-muted-foreground">
        {booked}/{required}
      </span>
      {pct >= 80 && (
        <Warning className="size-3.5 text-amber-400 shrink-0" weight="fill" />
      )}
    </div>
  );
}

// ── Event Card ──

function EventCard({
  event,
  index,
  onClick,
}: {
  event: SalesforceEvent;
  index: number;
  onClick: () => void;
}) {
  const catStyle = getCatStyle(event.Category__c);
  const daysLeft = event.Start_Date__c ? daysUntil(event.Start_Date__c) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const revenueTarget = event.Revenue_Target__c || 0;
  const revenueActual = event.Sum_of_Closed_Won_Gross__c || 0;
  const revenuePct =
    revenueTarget > 0
      ? Math.min(100, Math.round((revenueActual / revenueTarget) * 100))
      : 0;
  const imageUrl = event.Event_Image_1__c;
  const completionPct = event.Percentage_Reservations_Completion__c || 0;
  const totalBooked = event.Total_Tickets_Booked__c || 0;
  const totalRequired = event.Total_Tickets_Required__c || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.03 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div
        className={`relative overflow-hidden rounded-xl border border-border/40 bg-card hover:border-border/80 transition-all duration-300 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20 ${isPast ? "opacity-60" : ""}`}
      >
        {/* Image Header */}
        <div className="relative h-44 overflow-hidden bg-muted/20">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted/40 to-muted/10 flex items-center justify-center">
              <CalendarBlank className="size-12 text-muted-foreground/20" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${catStyle.bg} ${catStyle.text} border border-white/10`}
            >
              {event.Category__c || "Event"}
            </span>
            {daysLeft !== null && (
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${
                  isPast
                    ? "bg-black/40 text-white/60"
                    : daysLeft <= 7
                      ? "bg-red-500/20 text-red-300 border border-red-500/20"
                      : daysLeft <= 30
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/20"
                        : "bg-white/10 text-white/80 border border-white/10"
                }`}
              >
                {isPast ? "Passed" : `${daysLeft}d`}
              </span>
            )}
          </div>

          {/* Date badge (bottom-left of image) */}
          {event.Start_Date__c && (
            <div className="absolute bottom-3 left-3">
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/10">
                <div className="text-center">
                  <div className="text-lg font-light text-white leading-none">
                    {new Date(event.Start_Date__c).getDate()}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest text-white/70 font-semibold">
                    {new Date(event.Start_Date__c).toLocaleDateString("en-GB", {
                      month: "short",
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Revenue mini-indicator (bottom-right of image) */}
          {revenueTarget > 0 && (
            <div className="absolute bottom-3 right-3">
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/10">
                <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${revenuePct >= 100 ? "bg-emerald-400" : revenuePct >= 50 ? "bg-blue-400" : "bg-amber-400"}`}
                    style={{ width: `${revenuePct}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/70 tabular-nums font-medium">
                  {revenuePct}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4">
          <h3 className="font-semibold text-sm leading-snug mb-1.5 line-clamp-2 group-hover:text-foreground transition-colors">
            {event.Name}
          </h3>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            {event.Location__r?.Name && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="size-3 shrink-0" />
                {event.Location__r.Name}
              </span>
            )}
            {event.Start_Date__c && event.End_Date__c && (
              <span className="flex items-center gap-1 shrink-0">
                <CalendarBlank className="size-3" />
                {formatDateRange(event.Start_Date__c, event.End_Date__c)}
              </span>
            )}
          </div>

          {/* Revenue + Tickets row */}
          <div className="flex items-center gap-3">
            {revenueActual > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <CurrencyGbp className="size-3 text-emerald-400" />
                <span className="font-semibold tabular-nums text-foreground/90">
                  {formatCurrency(revenueActual)}
                </span>
                {revenueTarget > 0 && (
                  <span className="text-muted-foreground/50">
                    / {formatCurrency(revenueTarget)}
                  </span>
                )}
              </div>
            )}
            {totalRequired > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                <Ticket className="size-3" />
                <span className="tabular-nums">
                  {totalBooked}/{totalRequired}
                </span>
                <span className="text-muted-foreground/50">
                  ({Math.round(completionPct)}%)
                </span>
              </div>
            )}
          </div>

          {/* Arrow indicator */}
          <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
              View Details
              <CaretRight className="size-3" />
            </span>
          </div>
        </div>

        {/* Past overlay */}
        {isPast && (
          <div className="pointer-events-none absolute inset-0 bg-background/30" />
        )}
      </div>
    </motion.div>
  );
}

// ── Full-Screen Event Detail ──

function EventDetail({
  event,
  onClose,
}: {
  event: SalesforceEvent;
  onClose: () => void;
}) {
  const [opportunities, setOpportunities] = useState<
    SalesforceOpportunityFull[]
  >([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "tickets" | "deals" | "financials"
  >("overview");

  // Fetch linked opportunities
  useEffect(() => {
    const fetchOpps = async () => {
      try {
        const res = await fetch(`/api/events/inventory/${event.Id}`);
        const data = await res.json();
        if (data.success) setOpportunities(data.data);
      } catch (e) {
        console.error("Failed to load event opportunities", e);
      } finally {
        setOppsLoading(false);
      }
    };
    fetchOpps();
  }, [event.Id]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const catStyle = getCatStyle(event.Category__c);
  const daysLeft = event.Start_Date__c ? daysUntil(event.Start_Date__c) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const revenueTarget = event.Revenue_Target__c || 0;
  const revenueActual = event.Sum_of_Closed_Won_Gross__c || 0;
  const revenuePct =
    revenueTarget > 0
      ? Math.min(100, Math.round((revenueActual / revenueTarget) * 100))
      : 0;
  const margin = event.Margin_Percentage__c;
  const totalBooked = event.Total_Tickets_Booked__c || 0;
  const totalRequired = event.Total_Tickets_Required__c || 0;
  const completionPct = event.Percentage_Reservations_Completion__c || 0;

  // Get all images
  const images = [
    event.Event_Image_1__c,
    event.Event_Image_2__c,
    event.Event_Image_3__c,
    event.Event_Image_4__c,
    event.Event_Image_5__c,
  ].filter(Boolean) as string[];

  // Opportunity breakdowns
  const oppsByStage = useMemo(() => {
    const grouped: Record<string, SalesforceOpportunityFull[]> = {};
    for (const opp of opportunities) {
      const stage = opp.StageName;
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(opp);
    }
    return grouped;
  }, [opportunities]);

  const totalOppRevenue = useMemo(
    () =>
      opportunities.reduce(
        (sum, o) => sum + (o.Gross_Amount__c || o.Amount || 0),
        0,
      ),
    [opportunities],
  );

  const wonOpps = useMemo(
    () =>
      opportunities.filter((o) =>
        ["Agreement Signed", "Amended", "Amendment Signed"].includes(
          o.StageName,
        ),
      ),
    [opportunities],
  );

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "tickets" as const, label: "Tickets" },
    { id: "deals" as const, label: `Deals (${opportunities.length})` },
    { id: "financials" as const, label: "Financials" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-stretch justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-6xl m-6 bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Image */}
        <div className="relative h-72 shrink-0 overflow-hidden">
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(images[0])}`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted/40 to-muted/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 size-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-colors"
          >
            <X className="size-4" weight="bold" />
          </button>

          {/* Event title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${catStyle.bg} ${catStyle.text} border border-white/10`}
                  >
                    {event.Category__c || "Event"}
                  </span>
                  {daysLeft !== null && (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ${
                        isPast
                          ? "bg-muted/30 text-muted-foreground"
                          : daysLeft <= 7
                            ? "bg-red-500/15 text-red-400"
                            : daysLeft <= 30
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-emerald-500/15 text-emerald-400"
                      }`}
                    >
                      {isPast ? "Event Passed" : `${daysLeft} days away`}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {event.Name}
                </h2>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                  {event.Location__r?.Name && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {event.Location__r.Name}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <CalendarBlank className="size-4" />
                    {formatDateRange(event.Start_Date__c, event.End_Date__c)}
                  </span>
                  {(event.Start_Time__c || event.End_Time__c) && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" />
                      {formatTime(event.Start_Time__c)}
                      {event.End_Time__c &&
                        ` – ${formatTime(event.End_Time__c)}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-3 shrink-0">
                {revenueTarget > 0 && (
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums text-foreground">
                      {formatCurrency(revenueActual)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      of {formatCurrency(revenueTarget)} ({revenuePct}%)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border/50 px-6">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* KPI Row */}
              <div className="grid grid-cols-5 gap-4">
                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ChartLineUp className="size-4 text-emerald-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Revenue
                    </span>
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {formatCurrency(revenueActual)}
                  </div>
                  {revenueTarget > 0 && (
                    <>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Target: {formatCurrency(revenueTarget)}
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all ${revenuePct >= 100 ? "bg-emerald-500" : revenuePct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                          style={{ width: `${revenuePct}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CurrencyGbp className="size-4 text-blue-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Margin
                    </span>
                  </div>
                  <div
                    className={`text-lg font-bold tabular-nums ${
                      margin != null && margin >= 30
                        ? "text-emerald-400"
                        : margin != null && margin >= 15
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {margin != null ? `${margin.toFixed(1)}%` : "—"}
                  </div>
                  {event.Total_Margin_Value__c != null && (
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {formatCurrency(event.Total_Margin_Value__c)}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Ticket className="size-4 text-violet-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Tickets
                    </span>
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {totalBooked}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{totalRequired}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {Math.round(completionPct)}% fulfilled
                  </div>
                </div>

                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="size-4 text-orange-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Deals
                    </span>
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {oppsLoading ? "…" : opportunities.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {wonOpps.length} won
                  </div>
                </div>

                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CurrencyGbp className="size-4 text-teal-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Payments
                    </span>
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {formatCurrency(event.Total_Payments_Received__c || 0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Collected
                  </div>
                </div>
              </div>

              {/* Description + Staff */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 rounded-xl bg-muted/10 border border-border/30 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
                    Description
                  </h4>
                  {event.Description__c ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {event.Description__c}
                    </p>
                  ) : event.Event_Notes__c ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {event.Event_Notes__c}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/50 italic">
                      No description available
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
                    Team & Operations
                  </h4>
                  <div className="space-y-3">
                    {event.Owner?.Name && (
                      <div>
                        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                          Owner
                        </div>
                        <div className="text-sm flex items-center gap-1.5 mt-0.5">
                          <UserCircle className="size-4 text-muted-foreground" />
                          {event.Owner.Name}
                        </div>
                      </div>
                    )}
                    {(event.A_B_On_Site_1__c || event.A_B_On_Site_2__c) && (
                      <div>
                        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                          On-Site Staff
                        </div>
                        <div className="text-sm mt-0.5">
                          {[event.A_B_On_Site_1__c, event.A_B_On_Site_2__c]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </div>
                    )}
                    {event.Total_Projects__c != null && (
                      <div>
                        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                          Projects
                        </div>
                        <div className="text-sm mt-0.5">
                          {event.Total_Projects__c}
                        </div>
                      </div>
                    )}
                    {event.Master_Package_Code__c && (
                      <div>
                        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                          Package Code
                        </div>
                        <div className="text-sm mt-0.5 font-mono text-xs">
                          {event.Master_Package_Code__c}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pipeline by stage (mini) */}
              {!oppsLoading && opportunities.length > 0 && (
                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
                    Deal Pipeline
                  </h4>
                  <div className="flex items-center gap-2">
                    {Object.entries(oppsByStage).map(([stage, opps]) => {
                      const stageConfig = OPPORTUNITY_STAGES[stage];
                      const stageTotal = opps.reduce(
                        (s, o) => s + (o.Gross_Amount__c || o.Amount || 0),
                        0,
                      );
                      const widthPct =
                        totalOppRevenue > 0
                          ? Math.max(
                              8,
                              (stageTotal / totalOppRevenue) * 100,
                            )
                          : 100 / Object.keys(oppsByStage).length;
                      return (
                        <div
                          key={stage}
                          className="flex-1 min-w-0"
                          style={{ flex: widthPct }}
                        >
                          <div
                            className={`h-8 rounded-lg flex items-center justify-center px-2 ${stageConfig?.bgColor || "bg-muted/30 text-muted-foreground"}`}
                          >
                            <span className="text-[10px] font-medium truncate">
                              {stage}
                            </span>
                          </div>
                          <div className="text-center mt-1">
                            <div className="text-[10px] font-bold tabular-nums">
                              {opps.length}
                            </div>
                            <div className="text-[9px] text-muted-foreground/50 tabular-nums">
                              {formatCurrency(stageTotal)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Images gallery */}
              {images.length > 1 && (
                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
                    Gallery
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, i) => (
                      <div
                        key={i}
                        className="aspect-video rounded-lg overflow-hidden bg-muted/20"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(img)}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "tickets" && (
            <div className="space-y-4">
              {/* Overall ticket progress */}
              <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium">
                    Overall Ticket Inventory
                  </h4>
                  <span className="text-sm tabular-nums font-bold">
                    {totalBooked}/{totalRequired}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({Math.round(completionPct)}%)
                    </span>
                  </span>
                </div>
                <div className="h-3 bg-muted/30 rounded-full overflow-hidden mb-6">
                  <div
                    className={`h-full rounded-full transition-all ${completionPct >= 90 ? "bg-red-500" : completionPct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${completionPct}%` }}
                  />
                </div>

                <div className="space-y-2.5">
                  {TICKET_TYPES.map((tt) => {
                    const required =
                      (event[
                        tt.requiredField as keyof SalesforceEvent
                      ] as number | null) || 0;
                    const booked =
                      (event[
                        tt.bookedField as keyof SalesforceEvent
                      ] as number | null) || 0;
                    return (
                      <TicketBar
                        key={tt.label}
                        label={tt.label}
                        icon={tt.icon}
                        required={required}
                        booked={booked}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Scarcity alerts */}
              {TICKET_TYPES.some((tt) => {
                const req =
                  (event[
                    tt.requiredField as keyof SalesforceEvent
                  ] as number | null) || 0;
                const bkd =
                  (event[
                    tt.bookedField as keyof SalesforceEvent
                  ] as number | null) || 0;
                return req > 0 && bkd / req >= 0.8;
              }) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Warning
                      className="size-4 text-amber-400"
                      weight="fill"
                    />
                    <span className="text-sm font-medium text-amber-400">
                      Low Inventory Alert
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TICKET_TYPES.filter((tt) => {
                      const req =
                        (event[
                          tt.requiredField as keyof SalesforceEvent
                        ] as number | null) || 0;
                      const bkd =
                        (event[
                          tt.bookedField as keyof SalesforceEvent
                        ] as number | null) || 0;
                      return req > 0 && bkd / req >= 0.8;
                    }).map((tt) => {
                      const req =
                        (event[
                          tt.requiredField as keyof SalesforceEvent
                        ] as number | null) || 0;
                      const bkd =
                        (event[
                          tt.bookedField as keyof SalesforceEvent
                        ] as number | null) || 0;
                      return (
                        <span
                          key={tt.label}
                          className="text-xs bg-amber-500/10 text-amber-300/80 px-2.5 py-1 rounded-full"
                        >
                          {tt.label}: {bkd}/{req} (
                          {Math.round((bkd / req) * 100)}%)
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "deals" && (
            <div className="space-y-4">
              {oppsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 rounded-xl bg-muted/20 animate-pulse"
                    />
                  ))}
                </div>
              ) : opportunities.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  No deals linked to this event yet.
                </p>
              ) : (
                Object.entries(oppsByStage).map(([stage, opps]) => {
                  const stageConfig = OPPORTUNITY_STAGES[stage];
                  return (
                    <div key={stage}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${stageConfig?.bgColor || "bg-muted/30 text-muted-foreground"}`}
                        >
                          {stage}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {opps.length} deal{opps.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground/50 ml-auto tabular-nums">
                          {formatCurrency(
                            opps.reduce(
                              (s, o) =>
                                s + (o.Gross_Amount__c || o.Amount || 0),
                              0,
                            ),
                          )}
                        </span>
                      </div>
                      <div className="space-y-1.5 mb-4">
                        {opps.map((opp) => (
                          <div
                            key={opp.Id}
                            className="flex items-center gap-3 rounded-lg bg-muted/10 border border-border/20 px-4 py-2.5 text-sm"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {opp.Name}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {opp.Account?.Name && (
                                  <span>{opp.Account.Name}</span>
                                )}
                                {opp.Owner?.Name && (
                                  <>
                                    <span className="text-muted-foreground/30">
                                      •
                                    </span>
                                    <span>{opp.Owner.Name}</span>
                                  </>
                                )}
                                {opp.Package_Sold__r?.Name && (
                                  <>
                                    <span className="text-muted-foreground/30">
                                      •
                                    </span>
                                    <span className="text-violet-400/80">
                                      {opp.Package_Sold__r.Name}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold tabular-nums">
                                {formatCurrency(
                                  opp.Gross_Amount__c || opp.Amount || 0,
                                )}
                              </div>
                              {opp.Percentage_Paid__c != null && (
                                <div className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1 justify-end">
                                  {opp.Percentage_Paid__c >= 100 ? (
                                    <CheckCircle className="size-3 text-emerald-400" />
                                  ) : null}
                                  {Math.round(opp.Percentage_Paid__c)}% paid
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "financials" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    Revenue (Closed Won)
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-emerald-400">
                    {formatCurrency(revenueActual)}
                  </div>
                  {revenueTarget > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {revenuePct}% of {formatCurrency(revenueTarget)} target
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    Payments Received
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-teal-400">
                    {formatCurrency(event.Total_Payments_Received__c || 0)}
                  </div>
                  {revenueActual > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {Math.round(
                        ((event.Total_Payments_Received__c || 0) /
                          revenueActual) *
                          100,
                      )}
                      % collected
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    Margin
                  </div>
                  <div
                    className={`text-2xl font-bold tabular-nums ${margin != null && margin >= 30 ? "text-emerald-400" : margin != null && margin >= 15 ? "text-amber-400" : "text-red-400"}`}
                  >
                    {margin != null ? `${margin.toFixed(1)}%` : "—"}
                  </div>
                  {event.Total_Margin_Value__c != null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(event.Total_Margin_Value__c)} value
                    </div>
                  )}
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-4">
                  Cost Breakdown
                </h4>
                <div className="space-y-3">
                  {[
                    {
                      label: "Booking Costs",
                      value: event.Total_Booking_Cost__c,
                    },
                    {
                      label: "Staff Costs",
                      value: event.Total_Staff_Costs__c,
                    },
                  ]
                    .filter((c) => c.value != null && c.value > 0)
                    .map((cost) => (
                      <div
                        key={cost.label}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {cost.label}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(cost.value!)}
                        </span>
                      </div>
                    ))}
                  {(event.Total_Booking_Cost__c || 0) +
                    (event.Total_Staff_Costs__c || 0) >
                    0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30">
                      <span className="font-medium">Total Costs</span>
                      <span className="font-bold tabular-nums">
                        {formatCurrency(
                          (event.Total_Booking_Cost__c || 0) +
                            (event.Total_Staff_Costs__c || 0),
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pipeline total */}
              {!oppsLoading && totalOppRevenue > 0 && (
                <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    Total Pipeline Value
                  </h4>
                  <div className="text-2xl font-bold tabular-nums">
                    {formatCurrency(totalOppRevenue)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Across {opportunities.length} deals
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ──

export default function EventsPage() {
  const [events, setEvents] = useState<SalesforceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SalesforceEvent | null>(
    null,
  );
  const [sortBy, setSortBy] = useState<"date" | "revenue" | "margin">("date");
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch events from Salesforce
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events/inventory");
      const data = await res.json();
      if (data.success) setEvents(data.data);
    } catch (e) {
      console.error("Failed to load events", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchEvents(), 60000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Derive unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of events) {
      if (e.Category__c) cats.add(e.Category__c);
    }
    return Array.from(cats).sort();
  }, [events]);

  // Derive unique months from events
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    for (const e of events) {
      if (e.Start_Date__c) {
        const d = new Date(e.Start_Date__c);
        monthSet.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        );
      }
    }
    return Array.from(monthSet).sort();
  }, [events]);

  // Filtered and sorted events
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.Name.toLowerCase().includes(q) ||
          (e.Category__c && e.Category__c.toLowerCase().includes(q)) ||
          (e.Location__r?.Name &&
            e.Location__r.Name.toLowerCase().includes(q)),
      );
    }

    // Category
    if (selectedCategory !== "all") {
      result = result.filter((e) => e.Category__c === selectedCategory);
    }

    // Month
    if (selectedMonth !== "all") {
      result = result.filter((e) => {
        if (!e.Start_Date__c) return false;
        const d = new Date(e.Start_Date__c);
        return (
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` ===
          selectedMonth
        );
      });
    }

    // Past events
    if (!showPastEvents) {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter((e) => {
        // Keep events with no end date, or end date >= today
        if (!e.End_Date__c && !e.Start_Date__c) return true;
        const endDate = e.End_Date__c || e.Start_Date__c;
        return endDate! >= today;
      });
    }

    // Sort
    switch (sortBy) {
      case "date":
        result.sort((a, b) =>
          (a.Start_Date__c || "").localeCompare(b.Start_Date__c || ""),
        );
        break;
      case "revenue":
        result.sort(
          (a, b) =>
            (b.Sum_of_Closed_Won_Gross__c || 0) -
            (a.Sum_of_Closed_Won_Gross__c || 0),
        );
        break;
      case "margin":
        result.sort(
          (a, b) =>
            (b.Margin_Percentage__c || 0) - (a.Margin_Percentage__c || 0),
        );
        break;
    }

    return result;
  }, [
    events,
    search,
    selectedCategory,
    selectedMonth,
    showPastEvents,
    sortBy,
  ]);

  // Group events by month for the calendar view
  const eventsByMonth = useMemo(() => {
    const grouped: Record<string, SalesforceEvent[]> = {};
    for (const e of filteredEvents) {
      if (!e.Start_Date__c) continue;
      const d = new Date(e.Start_Date__c);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    }
    return grouped;
  }, [filteredEvents]);

  // Summary stats
  const stats = useMemo(() => {
    const upcoming = filteredEvents.filter((e) => {
      const d = daysUntil(e.Start_Date__c);
      return d !== null && d >= 0;
    });
    const totalRevenue = filteredEvents.reduce(
      (s, e) => s + (e.Sum_of_Closed_Won_Gross__c || 0),
      0,
    );
    const totalTarget = filteredEvents.reduce(
      (s, e) => s + (e.Revenue_Target__c || 0),
      0,
    );
    const avgMargin =
      filteredEvents.filter((e) => e.Margin_Percentage__c != null).length > 0
        ? filteredEvents.reduce(
            (s, e) => s + (e.Margin_Percentage__c || 0),
            0,
          ) /
          filteredEvents.filter((e) => e.Margin_Percentage__c != null).length
        : 0;

    return {
      total: filteredEvents.length,
      upcoming: upcoming.length,
      totalRevenue,
      totalTarget,
      avgMargin,
    };
  }, [filteredEvents]);

  const activeFilters =
    (selectedCategory !== "all" ? 1 : 0) +
    (selectedMonth !== "all" ? 1 : 0) +
    (showPastEvents ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const formatMonthLabel = (yyyyMM: string) => {
    const [y, m] = yyyyMM.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  };

  return (
    <div
      ref={scrollRef}
      className="h-dvh overflow-y-auto bg-gradient-to-br from-background to-muted/20 p-6 pl-24 lg:p-8 lg:pl-24"
    >
      <div className="max-w-[1600px] mx-auto pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Events</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {stats.total} events
                {stats.upcoming > 0 && ` • ${stats.upcoming} upcoming`}
              </p>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                fetchEvents();
              }}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
            >
              <ArrowsClockwise
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl bg-card border border-border/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Total Events
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {stats.total}
              </div>
            </div>
            <div className="rounded-xl bg-card border border-border/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Total Revenue
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-emerald-400">
                {formatCurrency(stats.totalRevenue)}
              </div>
              {stats.totalTarget > 0 && (
                <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {Math.round((stats.totalRevenue / stats.totalTarget) * 100)}%
                  of {formatCurrency(stats.totalTarget)}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-card border border-border/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Avg. Margin
              </div>
              <div
                className={`text-2xl font-bold tabular-nums mt-1 ${stats.avgMargin >= 30 ? "text-emerald-400" : stats.avgMargin >= 15 ? "text-amber-400" : "text-red-400"}`}
              >
                {stats.avgMargin > 0 ? `${stats.avgMargin.toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="rounded-xl bg-card border border-border/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Upcoming
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {stats.upcoming}
              </div>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events, venues, cities..."
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-card border border-border/50 text-sm focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition-colors placeholder:text-muted-foreground/50"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Category dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-card border border-border/50 text-sm focus:outline-none focus:border-foreground/30 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Month dropdown */}
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-card border border-border/50 text-sm focus:outline-none focus:border-foreground/30 cursor-pointer"
              >
                <option value="all">All Months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
              <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "date" | "revenue" | "margin")
                }
                className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-card border border-border/50 text-sm focus:outline-none focus:border-foreground/30 cursor-pointer"
              >
                <option value="date">Sort: Date</option>
                <option value="revenue">Sort: Revenue</option>
                <option value="margin">Sort: Margin</option>
              </select>
              <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Show past events toggle */}
            <button
              onClick={() => setShowPastEvents(!showPastEvents)}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                showPastEvents
                  ? "bg-foreground/10 border-foreground/20 text-foreground"
                  : "bg-card border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {showPastEvents ? "Hide Past" : "Show Past"}
            </button>

            {/* Reset */}
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("all");
                  setSelectedMonth("all");
                  setShowPastEvents(false);
                  setSortBy("date");
                }}
                className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 text-sm hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
              >
                <X className="size-3" />
                Reset ({activeFilters})
              </button>
            )}
          </div>
        </motion.div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/30 bg-card/30 overflow-hidden animate-pulse"
              >
                <div className="h-44 bg-muted/30" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-muted/30 rounded" />
                  <div className="h-3 w-1/2 bg-muted/20 rounded" />
                  <div className="h-3 w-2/3 bg-muted/20 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <CalendarBlank className="size-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">No events found</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              Try adjusting your filters or search terms
            </p>
          </div>
        ) : sortBy === "date" &&
          selectedMonth === "all" &&
          !search.trim() ? (
          // Grouped by month when sorted by date and not filtering by a specific month
          <div className="space-y-10">
            {Object.entries(eventsByMonth)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([monthKey, monthEvents]) => (
                <div key={monthKey}>
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="text-lg font-semibold">
                      {formatMonthLabel(monthKey)}
                    </h2>
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-xs text-muted-foreground">
                      {monthEvents.length} event
                      {monthEvents.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {monthEvents.map((event, i) => (
                      <EventCard
                        key={event.Id}
                        event={event}
                        index={i}
                        onClick={() => setSelectedEvent(event)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          // Flat grid when searching, filtering by month, or sorting by non-date
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredEvents.map((event, i) => (
              <EventCard
                key={event.Id}
                event={event}
                index={i}
                onClick={() => setSelectedEvent(event)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full-screen event detail overlay */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetail
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
