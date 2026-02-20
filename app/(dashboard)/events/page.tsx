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
  CaretRight,
  Users,
  ChartLineUp,
  Clock,
  ArrowsClockwise,
  CheckCircle,
  CaretDown,
  Trophy,
  TrendUp,
  Timer,
  Flag,
  Horse,
  TennisBall,
  Football,
  MusicNote,
  Star,
  Lightning,
  FlagCheckered,
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

// ── Category Visual System ──
// Rich gradient backgrounds per category so cards look stunning even without photos

const CATEGORY_VISUALS: Record<
  string,
  { gradient: string; icon: React.ComponentType<{ className?: string; weight?: "fill" | "regular" | "bold" | "light" | "thin" | "duotone" }>; accent: string }
> = {
  "formula 1": { gradient: "from-red-950 via-red-900 to-red-800", icon: FlagCheckered, accent: "text-red-400" },
  "formula-1": { gradient: "from-red-950 via-red-900 to-red-800", icon: FlagCheckered, accent: "text-red-400" },
  "f1": { gradient: "from-red-950 via-red-900 to-red-800", icon: FlagCheckered, accent: "text-red-400" },
  "f1 driving experience": { gradient: "from-red-950 via-red-900 to-red-800", icon: FlagCheckered, accent: "text-red-400" },
  "motor racing": { gradient: "from-red-950 via-red-900/80 to-zinc-900", icon: FlagCheckered, accent: "text-red-400" },
  "motorsport": { gradient: "from-red-950 via-red-900/80 to-zinc-900", icon: FlagCheckered, accent: "text-red-400" },
  "tennis": { gradient: "from-green-950 via-green-900 to-emerald-900", icon: TennisBall, accent: "text-green-400" },
  "rugby": { gradient: "from-violet-950 via-violet-900 to-purple-900", icon: Football, accent: "text-violet-400" },
  "football": { gradient: "from-emerald-950 via-emerald-900 to-green-900", icon: Football, accent: "text-emerald-400" },
  "golf": { gradient: "from-teal-950 via-teal-900 to-cyan-900", icon: Flag, accent: "text-teal-400" },
  "cricket": { gradient: "from-lime-950 via-lime-900 to-green-900", icon: Trophy, accent: "text-lime-400" },
  "horse racing": { gradient: "from-amber-950 via-amber-900 to-yellow-900", icon: Horse, accent: "text-amber-400" },
  "horse-racing": { gradient: "from-amber-950 via-amber-900 to-yellow-900", icon: Horse, accent: "text-amber-400" },
  "boxing": { gradient: "from-rose-950 via-rose-900 to-red-900", icon: Lightning, accent: "text-rose-400" },
  "combat sports": { gradient: "from-rose-950 via-rose-900 to-red-900", icon: Lightning, accent: "text-rose-400" },
  "darts": { gradient: "from-orange-950 via-orange-900 to-amber-900", icon: Star, accent: "text-orange-400" },
  "live music": { gradient: "from-pink-950 via-pink-900 to-fuchsia-900", icon: MusicNote, accent: "text-pink-400" },
  "live-music": { gradient: "from-pink-950 via-pink-900 to-fuchsia-900", icon: MusicNote, accent: "text-pink-400" },
  "music": { gradient: "from-pink-950 via-pink-900 to-fuchsia-900", icon: MusicNote, accent: "text-pink-400" },
  "glastonbury": { gradient: "from-fuchsia-950 via-fuchsia-900 to-purple-900", icon: MusicNote, accent: "text-fuchsia-400" },
  "festival": { gradient: "from-fuchsia-950 via-fuchsia-900 to-purple-900", icon: MusicNote, accent: "text-fuchsia-400" },
  "theatre": { gradient: "from-fuchsia-950 via-fuchsia-900 to-rose-900", icon: Star, accent: "text-fuchsia-400" },
  "theatre/ performing arts": { gradient: "from-fuchsia-950 via-fuchsia-900 to-rose-900", icon: Star, accent: "text-fuchsia-400" },
  "fashion": { gradient: "from-pink-950 via-pink-900 to-rose-900", icon: Star, accent: "text-pink-400" },
  "culinary": { gradient: "from-orange-950 via-orange-900 to-amber-900", icon: ForkKnife, accent: "text-orange-400" },
  "luxury": { gradient: "from-purple-950 via-purple-900 to-violet-900", icon: Star, accent: "text-purple-400" },
  "luxury/lifestyle/celebrity": { gradient: "from-purple-950 via-purple-900 to-violet-900", icon: Star, accent: "text-purple-400" },
  "luxury skiing": { gradient: "from-sky-950 via-sky-900 to-blue-900", icon: Star, accent: "text-sky-400" },
  "nfl": { gradient: "from-blue-950 via-blue-900 to-indigo-900", icon: Football, accent: "text-blue-400" },
  "american sports": { gradient: "from-blue-950 via-blue-900 to-indigo-900", icon: Football, accent: "text-blue-400" },
  "basketball": { gradient: "from-orange-950 via-orange-900/80 to-zinc-900", icon: Trophy, accent: "text-orange-400" },
  "rowing/sailing": { gradient: "from-cyan-950 via-cyan-900 to-blue-900", icon: Flag, accent: "text-cyan-400" },
  "sailing": { gradient: "from-cyan-950 via-cyan-900 to-blue-900", icon: Flag, accent: "text-cyan-400" },
  "rowing": { gradient: "from-blue-950 via-blue-900 to-cyan-900", icon: Flag, accent: "text-blue-400" },
  "redbull factory tour": { gradient: "from-blue-950 via-indigo-900 to-zinc-900", icon: Lightning, accent: "text-blue-400" },
  "orient express": { gradient: "from-amber-950 via-amber-900/80 to-zinc-900", icon: Star, accent: "text-amber-400" },
  "awards": { gradient: "from-amber-950 via-amber-900 to-yellow-900", icon: Trophy, accent: "text-amber-400" },
  "athletics": { gradient: "from-blue-950 via-blue-900 to-sky-900", icon: TrendUp, accent: "text-blue-400" },
  "cycling": { gradient: "from-yellow-950 via-yellow-900 to-amber-900", icon: Timer, accent: "text-yellow-400" },
  "formula e": { gradient: "from-sky-950 via-sky-900 to-blue-900", icon: Lightning, accent: "text-sky-400" },
  "formula-e": { gradient: "from-sky-950 via-sky-900 to-blue-900", icon: Lightning, accent: "text-sky-400" },
  "art": { gradient: "from-indigo-950 via-indigo-900 to-violet-900", icon: Star, accent: "text-indigo-400" },
  "film": { gradient: "from-indigo-950 via-indigo-900 to-violet-900", icon: Star, accent: "text-indigo-400" },
  "multi-sport": { gradient: "from-sky-950 via-sky-900 to-indigo-900", icon: Trophy, accent: "text-sky-400" },
};

function getCategoryVisual(category: string | null) {
  if (!category) return { gradient: "from-zinc-900 via-zinc-800 to-zinc-700", icon: CalendarBlank, accent: "text-muted-foreground" };
  const key = category.toLowerCase();
  return CATEGORY_VISUALS[key] || CATEGORY_VISUALS[key.replace(/\s+/g, "-")] || { gradient: "from-zinc-900 via-zinc-800 to-zinc-700", icon: CalendarBlank, accent: "text-zinc-400" };
}

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
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (!e || s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  }
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
  }
  return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const parts = time.split(":");
  return `${parts[0]}:${parts[1]}`;
}

// ── Ticket Types ──

const TICKET_TYPES = [
  { label: "Event", icon: Ticket, requiredField: "Event_Tickets_Required__c", bookedField: "Event_Tickets_Booked__c" },
  { label: "Hospitality", icon: Package, requiredField: "Hospitality_Tickets_Required__c", bookedField: "Hospitality_Tickets_Booked__c" },
  { label: "Hotel", icon: Bed, requiredField: "Hotel_Tickets_Required__c", bookedField: "Hotel_Tickets_Booked__c" },
  { label: "Dinner", icon: ForkKnife, requiredField: "Dinner_Tickets_Required__c", bookedField: "Dinner_Tickets_Booked__c" },
  { label: "Drinks", icon: Martini, requiredField: "Drinks_Tickets_Required__c", bookedField: "Drinks_Tickets_Booked__c" },
  { label: "Party", icon: Confetti, requiredField: "Party_Tickets_Required__c", bookedField: "Party_Tickets_Booked__c" },
  { label: "Flights In", icon: AirplaneLanding, requiredField: "Inbound_Flight_Tickets_Required__c", bookedField: "Inbound_Flight_Tickets_Booked__c" },
  { label: "Flights Out", icon: AirplaneTakeoff, requiredField: "Outbound_Flight_Tickets_Required__c", bookedField: "Outbound_Flight_Tickets_Booked__c" },
  { label: "Transfers In", icon: Car, requiredField: "Inbound_Transfer_Tickets_Required__c", bookedField: "Inbound_Transfer_Tickets_Booked__c" },
  { label: "Transfers Out", icon: Car, requiredField: "Outbound_Transfer_Tickets_Required__c", bookedField: "Outbound_Transfer_Tickets_Booked__c" },
] as const;

// ── Ticket Bar ──

function TicketBar({ label, icon: Icon, required, booked }: { label: string; icon: React.ComponentType<{ className?: string }>; required: number; booked: number }) {
  if (required === 0) return null;
  const pct = Math.min(100, Math.round((booked / required) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span className="w-20 truncate text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 text-right tabular-nums text-muted-foreground">{booked}/{required}</span>
      {pct >= 80 && <Warning className="size-3.5 text-amber-400 shrink-0" weight="fill" />}
    </div>
  );
}

// ── Event Card (3:4 aspect, image-first, captivating) ──

function EventCard({ event, onClick }: { event: SalesforceEvent; onClick: () => void }) {
  const catStyle = getCatStyle(event.Category__c);
  const catVisual = getCategoryVisual(event.Category__c);
  const CatIcon = catVisual.icon;
  const daysLeft = event.Start_Date__c ? daysUntil(event.Start_Date__c) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const imageUrl = event.Event_Image_1__c;
  const revenueTarget = event.Revenue_Target__c || 0;
  const revenueActual = event.Sum_of_Closed_Won_Gross__c || 0;
  const revenuePct = revenueTarget > 0 ? Math.min(100, Math.round((revenueActual / revenueTarget) * 100)) : 0;

  const startDate = event.Start_Date__c ? new Date(event.Start_Date__c) : null;

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer relative overflow-hidden rounded-xl transition-all duration-500 hover:shadow-2xl hover:shadow-black/20 dark:hover:shadow-black/40 hover:-translate-y-1 ${isPast ? "opacity-50 hover:opacity-70" : ""}`}
      style={{ aspectRatio: "3/4" }}
    >
      {/* Background: image or rich category gradient */}
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/10 opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
        </>
      ) : (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${catVisual.gradient}`} />
          {/* Decorative icon watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06]">
            <CatIcon className="size-48" />
          </div>
          {/* Subtle noise texture */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </>
      )}

      {/* Content overlay */}
      <div className="relative h-full flex flex-col justify-between p-4">
        {/* Top: Category + countdown */}
        <div className="flex items-start justify-between">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider backdrop-blur-md ${catStyle.bg} ${catStyle.text} border border-white/10`}>
            {event.Category__c || "Event"}
          </span>
          {daysLeft !== null && !isPast && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md ${
              daysLeft <= 7 ? "bg-red-500/25 text-red-300" : daysLeft <= 30 ? "bg-amber-500/25 text-amber-300" : "bg-white/10 text-white/70"
            }`}>
              {daysLeft}d
            </span>
          )}
          {isPast && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/40 text-white/50 backdrop-blur-md">Past</span>
          )}
        </div>

        {/* Bottom: Event info */}
        <div className="space-y-2">
          {/* Date large display */}
          {startDate && (
            <div className="flex items-end gap-2.5">
              <div className="border-l border-white/30 pl-2.5">
                <div className="text-2xl font-light text-white leading-none">{startDate.getDate()}</div>
                <div className="text-[9px] uppercase tracking-[0.15em] text-white/60 font-semibold mt-0.5">
                  {startDate.toLocaleDateString("en-GB", { month: "short" })}
                </div>
              </div>
              {/* Revenue indicator */}
              {revenueTarget > 0 && (
                <div className="flex items-center gap-1.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-1 bg-white/15 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${revenuePct >= 100 ? "bg-emerald-400" : revenuePct >= 50 ? "bg-blue-400" : "bg-amber-400"}`} style={{ width: `${revenuePct}%` }} />
                  </div>
                  <span className="text-[9px] text-white/50 tabular-nums">{revenuePct}%</span>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:translate-y-[-2px] transition-transform duration-300">
            {event.Name}
          </h3>

          {/* Meta: location + date range — revealed on hover */}
          <div className="flex items-center gap-3 text-[11px] text-white/50 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 delay-75">
            {event.Location__r?.Name && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="size-3 shrink-0" />
                {event.Location__r.Name}
              </span>
            )}
            {event.Start_Date__c && event.End_Date__c && event.Start_Date__c !== event.End_Date__c && (
              <span className="shrink-0">{formatDateRange(event.Start_Date__c, event.End_Date__c)}</span>
            )}
          </div>

          {/* Arrow — hover only */}
          <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300 delay-100">
            <div className="size-7 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <CaretRight className="size-3 text-white" weight="bold" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Full-Screen Event Detail ──

function EventDetail({ event, onClose }: { event: SalesforceEvent; onClose: () => void }) {
  const [opportunities, setOpportunities] = useState<SalesforceOpportunityFull[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "tickets" | "deals" | "financials">("overview");

  useEffect(() => {
    const fetchOpps = async () => {
      try {
        const res = await fetch(`/api/events/inventory/${event.Id}`);
        const data = await res.json();
        if (data.success) setOpportunities(data.data);
      } catch (e) { console.error("Failed to load event opportunities", e); }
      finally { setOppsLoading(false); }
    };
    fetchOpps();
  }, [event.Id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handler); };
  }, [onClose]);

  const catStyle = getCatStyle(event.Category__c);
  const catVisual = getCategoryVisual(event.Category__c);
  const CatIcon = catVisual.icon;
  const daysLeft = event.Start_Date__c ? daysUntil(event.Start_Date__c) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const revenueTarget = event.Revenue_Target__c || 0;
  const revenueActual = event.Sum_of_Closed_Won_Gross__c || 0;
  const revenuePct = revenueTarget > 0 ? Math.min(100, Math.round((revenueActual / revenueTarget) * 100)) : 0;
  const margin = event.Margin_Percentage__c;
  const totalBooked = event.Total_Tickets_Booked__c || 0;
  const totalRequired = event.Total_Tickets_Required__c || 0;
  const completionPct = event.Percentage_Reservations_Completion__c || 0;
  const images = [event.Event_Image_1__c, event.Event_Image_2__c, event.Event_Image_3__c, event.Event_Image_4__c, event.Event_Image_5__c].filter(Boolean) as string[];

  const oppsByStage = useMemo(() => {
    const grouped: Record<string, SalesforceOpportunityFull[]> = {};
    for (const opp of opportunities) { if (!grouped[opp.StageName]) grouped[opp.StageName] = []; grouped[opp.StageName].push(opp); }
    return grouped;
  }, [opportunities]);

  const totalOppRevenue = useMemo(() => opportunities.reduce((sum, o) => sum + (o.Gross_Amount__c || o.Amount || 0), 0), [opportunities]);
  const wonOpps = useMemo(() => opportunities.filter((o) => ["Agreement Signed", "Amended", "Amendment Signed"].includes(o.StageName)), [opportunities]);

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "tickets" as const, label: "Tickets" },
    { id: "deals" as const, label: `Deals (${opportunities.length})` },
    { id: "financials" as const, label: "Financials" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-stretch justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-6xl m-6 bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}>

        {/* Hero */}
        <div className="relative h-64 shrink-0 overflow-hidden">
          {images.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/image-proxy?url=${encodeURIComponent(images[0])}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-black/20" />
            </>
          ) : (
            <>
              <div className={`absolute inset-0 bg-gradient-to-br ${catVisual.gradient}`} />
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.05]">
                <CatIcon className="size-64" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            </>
          )}

          <button onClick={onClose} className="absolute top-4 right-4 z-10 size-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-colors">
            <X className="size-4" weight="bold" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${catStyle.bg} ${catStyle.text} border border-white/10`}>
                    {event.Category__c || "Event"}
                  </span>
                  {daysLeft !== null && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ${
                      isPast ? "bg-muted/30 text-muted-foreground" : daysLeft <= 7 ? "bg-red-500/15 text-red-400" : daysLeft <= 30 ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
                    }`}>{isPast ? "Event Passed" : `${daysLeft} days away`}</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground">{event.Name}</h2>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                  {event.Location__r?.Name && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{event.Location__r.Name}</span>}
                  <span className="flex items-center gap-1.5"><CalendarBlank className="size-4" />{formatDateRange(event.Start_Date__c, event.End_Date__c)}</span>
                  {(event.Start_Time__c || event.End_Time__c) && (
                    <span className="flex items-center gap-1.5"><Clock className="size-4" />{formatTime(event.Start_Time__c)}{event.End_Time__c && ` – ${formatTime(event.End_Time__c)}`}</span>
                  )}
                </div>
              </div>
              {revenueTarget > 0 && (
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(revenueActual)}</div>
                  <div className="text-[10px] text-muted-foreground">of {formatCurrency(revenueTarget)} ({revenuePct}%)</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border/50 px-6">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground/70"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-5 gap-4">
                {[
                  { icon: ChartLineUp, iconColor: "text-emerald-400", label: "Revenue", value: formatCurrency(revenueActual), sub: revenueTarget > 0 ? `Target: ${formatCurrency(revenueTarget)}` : undefined, bar: revenueTarget > 0 ? revenuePct : undefined, barColor: revenuePct >= 100 ? "bg-emerald-500" : revenuePct >= 50 ? "bg-blue-500" : "bg-amber-500" },
                  { icon: CurrencyGbp, iconColor: "text-blue-400", label: "Margin", value: margin != null ? `${margin.toFixed(1)}%` : "—", valueColor: margin != null && margin >= 30 ? "text-emerald-400" : margin != null && margin >= 15 ? "text-amber-400" : "text-red-400", sub: event.Total_Margin_Value__c != null ? formatCurrency(event.Total_Margin_Value__c) : undefined },
                  { icon: Ticket, iconColor: "text-violet-400", label: "Tickets", value: `${totalBooked}/${totalRequired}`, sub: `${Math.round(completionPct)}% fulfilled` },
                  { icon: Users, iconColor: "text-orange-400", label: "Deals", value: oppsLoading ? "…" : String(opportunities.length), sub: `${wonOpps.length} won` },
                  { icon: CurrencyGbp, iconColor: "text-teal-400", label: "Payments", value: formatCurrency(event.Total_Payments_Received__c || 0), sub: "Collected" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl bg-muted/10 border border-border/30 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <kpi.icon className={`size-4 ${kpi.iconColor}`} />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{kpi.label}</span>
                    </div>
                    <div className={`text-lg font-bold tabular-nums ${kpi.valueColor || ""}`}>{kpi.value}</div>
                    {kpi.sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{kpi.sub}</div>}
                    {kpi.bar != null && (
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden mt-2">
                        <div className={`h-full rounded-full transition-all ${kpi.barColor}`} style={{ width: `${kpi.bar}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 rounded-xl bg-muted/10 border border-border/30 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Description</h4>
                  {event.Description__c ? <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{event.Description__c}</p>
                   : event.Event_Notes__c ? <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{event.Event_Notes__c}</p>
                   : <p className="text-sm text-muted-foreground/50 italic">No description available</p>}
                </div>
                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Team & Operations</h4>
                  <div className="space-y-3">
                    {event.Owner?.Name && <div><div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Owner</div><div className="text-sm flex items-center gap-1.5 mt-0.5"><UserCircle className="size-4 text-muted-foreground" />{event.Owner.Name}</div></div>}
                    {(event.A_B_On_Site_1__c || event.A_B_On_Site_2__c) && <div><div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">On-Site Staff</div><div className="text-sm mt-0.5">{[event.A_B_On_Site_1__c, event.A_B_On_Site_2__c].filter(Boolean).join(", ")}</div></div>}
                    {event.Total_Projects__c != null && <div><div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Projects</div><div className="text-sm mt-0.5">{event.Total_Projects__c}</div></div>}
                    {event.Master_Package_Code__c && <div><div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Package Code</div><div className="text-sm mt-0.5 font-mono text-xs">{event.Master_Package_Code__c}</div></div>}
                  </div>
                </div>
              </div>

              {!oppsLoading && opportunities.length > 0 && (
                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Deal Pipeline</h4>
                  <div className="flex items-center gap-2">
                    {Object.entries(oppsByStage).map(([stage, opps]) => {
                      const sc = OPPORTUNITY_STAGES[stage];
                      const st = opps.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0);
                      const wp = totalOppRevenue > 0 ? Math.max(8, (st / totalOppRevenue) * 100) : 100 / Object.keys(oppsByStage).length;
                      return (
                        <div key={stage} className="flex-1 min-w-0" style={{ flex: wp }}>
                          <div className={`h-8 rounded-lg flex items-center justify-center px-2 ${sc?.bgColor || "bg-muted/30 text-muted-foreground"}`}>
                            <span className="text-[10px] font-medium truncate">{stage}</span>
                          </div>
                          <div className="text-center mt-1">
                            <div className="text-[10px] font-bold tabular-nums">{opps.length}</div>
                            <div className="text-[9px] text-muted-foreground/50 tabular-nums">{formatCurrency(st)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {images.length > 1 && (
                <div className="rounded-xl bg-muted/10 border border-border/30 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Gallery</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="aspect-video rounded-lg overflow-hidden bg-muted/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/image-proxy?url=${encodeURIComponent(img)}`} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "tickets" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium">Overall Ticket Inventory</h4>
                  <span className="text-sm tabular-nums font-bold">{totalBooked}/{totalRequired} <span className="text-muted-foreground font-normal">({Math.round(completionPct)}%)</span></span>
                </div>
                <div className="h-3 bg-muted/30 rounded-full overflow-hidden mb-6">
                  <div className={`h-full rounded-full transition-all ${completionPct >= 90 ? "bg-red-500" : completionPct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${completionPct}%` }} />
                </div>
                <div className="space-y-2.5">
                  {TICKET_TYPES.map((tt) => {
                    const req = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0;
                    const bkd = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0;
                    return <TicketBar key={tt.label} label={tt.label} icon={tt.icon} required={req} booked={bkd} />;
                  })}
                </div>
              </div>
              {TICKET_TYPES.some((tt) => { const r = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0; const b = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0; return r > 0 && b / r >= 0.8; }) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2"><Warning className="size-4 text-amber-400" weight="fill" /><span className="text-sm font-medium text-amber-400">Low Inventory Alert</span></div>
                  <div className="flex flex-wrap gap-2">
                    {TICKET_TYPES.filter((tt) => { const r = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0; const b = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0; return r > 0 && b / r >= 0.8; }).map((tt) => {
                      const r = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0; const b = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0;
                      return <span key={tt.label} className="text-xs bg-amber-500/10 text-amber-300/80 px-2.5 py-1 rounded-full">{tt.label}: {b}/{r} ({Math.round((b / r) * 100)}%)</span>;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "deals" && (
            <div className="space-y-4">
              {oppsLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />)}</div>
               : opportunities.length === 0 ? <p className="text-center text-muted-foreground py-12">No deals linked to this event yet.</p>
               : Object.entries(oppsByStage).map(([stage, opps]) => {
                  const sc = OPPORTUNITY_STAGES[stage];
                  return (
                    <div key={stage}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${sc?.bgColor || "bg-muted/30 text-muted-foreground"}`}>{stage}</span>
                        <span className="text-xs text-muted-foreground">{opps.length} deal{opps.length !== 1 ? "s" : ""}</span>
                        <span className="text-xs text-muted-foreground/50 ml-auto tabular-nums">{formatCurrency(opps.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0))}</span>
                      </div>
                      <div className="space-y-1.5 mb-4">
                        {opps.map((opp) => (
                          <div key={opp.Id} className="flex items-center gap-3 rounded-lg bg-muted/10 border border-border/20 px-4 py-2.5 text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{opp.Name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {opp.Account?.Name && <span>{opp.Account.Name}</span>}
                                {opp.Owner?.Name && <><span className="text-muted-foreground/30">•</span><span>{opp.Owner.Name}</span></>}
                                {opp.Package_Sold__r?.Name && <><span className="text-muted-foreground/30">•</span><span className="text-violet-400/80">{opp.Package_Sold__r.Name}</span></>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold tabular-nums">{formatCurrency(opp.Gross_Amount__c || opp.Amount || 0)}</div>
                              {opp.Percentage_Paid__c != null && (
                                <div className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1 justify-end">
                                  {opp.Percentage_Paid__c >= 100 && <CheckCircle className="size-3 text-emerald-400" />}
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
              }
            </div>
          )}

          {activeTab === "financials" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Revenue (Closed Won)</div>
                  <div className="text-2xl font-bold tabular-nums text-emerald-400">{formatCurrency(revenueActual)}</div>
                  {revenueTarget > 0 && <div className="text-xs text-muted-foreground mt-1">{revenuePct}% of {formatCurrency(revenueTarget)} target</div>}
                </div>
                <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Payments Received</div>
                  <div className="text-2xl font-bold tabular-nums text-teal-400">{formatCurrency(event.Total_Payments_Received__c || 0)}</div>
                  {revenueActual > 0 && <div className="text-xs text-muted-foreground mt-1">{Math.round(((event.Total_Payments_Received__c || 0) / revenueActual) * 100)}% collected</div>}
                </div>
                <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Margin</div>
                  <div className={`text-2xl font-bold tabular-nums ${margin != null && margin >= 30 ? "text-emerald-400" : margin != null && margin >= 15 ? "text-amber-400" : "text-red-400"}`}>
                    {margin != null ? `${margin.toFixed(1)}%` : "—"}
                  </div>
                  {event.Total_Margin_Value__c != null && <div className="text-xs text-muted-foreground mt-1">{formatCurrency(event.Total_Margin_Value__c)} value</div>}
                </div>
              </div>
              <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-4">Cost Breakdown</h4>
                <div className="space-y-3">
                  {[{ label: "Booking Costs", value: event.Total_Booking_Cost__c }, { label: "Staff Costs", value: event.Total_Staff_Costs__c }]
                    .filter((c) => c.value != null && c.value > 0)
                    .map((cost) => (
                      <div key={cost.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{cost.label}</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(cost.value!)}</span>
                      </div>
                    ))}
                  {(event.Total_Booking_Cost__c || 0) + (event.Total_Staff_Costs__c || 0) > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30">
                      <span className="font-medium">Total Costs</span>
                      <span className="font-bold tabular-nums">{formatCurrency((event.Total_Booking_Cost__c || 0) + (event.Total_Staff_Costs__c || 0))}</span>
                    </div>
                  )}
                </div>
              </div>
              {!oppsLoading && totalOppRevenue > 0 && (
                <div className="rounded-xl bg-muted/10 border border-border/30 p-5">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Total Pipeline Value</h4>
                  <div className="text-2xl font-bold tabular-nums">{formatCurrency(totalOppRevenue)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Across {opportunities.length} deals</div>
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
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SalesforceEvent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events/inventory");
      const data = await res.json();
      if (data.success) setEvents(data.data);
    } catch (e) { console.error("Failed to load events", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { const i = setInterval(fetchEvents, 60000); return () => clearInterval(i); }, [fetchEvents]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of events) { if (e.Category__c) cats.add(e.Category__c); }
    return Array.from(cats).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    let result = [...events];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.Name.toLowerCase().includes(q) || (e.Category__c && e.Category__c.toLowerCase().includes(q)) || (e.Location__r?.Name && e.Location__r.Name.toLowerCase().includes(q)));
    }
    if (selectedCategory !== "all") result = result.filter((e) => e.Category__c === selectedCategory);
    if (!showPastEvents) {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter((e) => { if (!e.End_Date__c && !e.Start_Date__c) return true; return (e.End_Date__c || e.Start_Date__c)! >= today; });
    }
    result.sort((a, b) => (a.Start_Date__c || "").localeCompare(b.Start_Date__c || ""));
    return result;
  }, [events, search, selectedCategory, showPastEvents]);

  // Group events by month — always
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

  const formatMonthLabel = (yyyyMM: string) => {
    const [y, m] = yyyyMM.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  };

  const activeFilters = (selectedCategory !== "all" ? 1 : 0) + (showPastEvents ? 1 : 0) + (search.trim() ? 1 : 0);

  return (
    <div ref={scrollRef} className="h-dvh overflow-y-auto bg-background p-6 pl-24 lg:p-8 lg:pl-24">
      <div className="max-w-[1600px] mx-auto pb-24">

        {/* Compact sticky header */}
        <div className="sticky top-0 z-40 -mx-6 px-6 -mt-6 pt-6 lg:-mx-8 lg:px-8 lg:-mt-8 lg:pt-8 pb-4 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="flex items-center gap-4">
            {/* Title */}
            <h1 className="text-xl font-bold tracking-tight shrink-0">Events</h1>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{filteredEvents.length} events</span>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative w-64">
              <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-muted/30 border border-border/40 text-sm focus:outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 transition-colors placeholder:text-muted-foreground/40"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Category */}
            <div className="relative">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-2.5 pr-7 py-1.5 rounded-lg bg-muted/30 border border-border/40 text-sm focus:outline-none focus:border-foreground/20 cursor-pointer">
                <option value="all">All Categories</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <CaretDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
            </div>

            {/* Past toggle */}
            <button onClick={() => setShowPastEvents(!showPastEvents)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${showPastEvents ? "bg-foreground/10 border-foreground/20 text-foreground" : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"}`}>
              {showPastEvents ? "Hide Past" : "Show Past"}
            </button>

            {activeFilters > 0 && (
              <button onClick={() => { setSearch(""); setSelectedCategory("all"); setShowPastEvents(false); }}
                className="px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 text-xs hover:bg-red-500/10 transition-colors flex items-center gap-1">
                <X className="size-3" /> Reset
              </button>
            )}

            {/* Refresh */}
            <button onClick={() => { setLoading(true); fetchEvents(); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg border border-border/40 bg-muted/30">
              <ArrowsClockwise className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Events — month sections */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-muted/20 animate-pulse" style={{ aspectRatio: "3/4" }} />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-32">
              <CalendarBlank className="size-16 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">No events found</p>
              <p className="text-muted-foreground/50 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="space-y-12">
              {Object.entries(eventsByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, monthEvents]) => (
                <section key={monthKey}>
                  {/* Month header */}
                  <div className="flex items-baseline gap-4 mb-5">
                    <h2 className="text-2xl font-bold tracking-tight">{formatMonthLabel(monthKey)}</h2>
                    <span className="text-xs text-muted-foreground/50">{monthEvents.length}</span>
                    <div className="flex-1 h-px bg-border/30 self-center" />
                  </div>

                  {/* Card grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {monthEvents.map((event) => (
                      <EventCard key={event.Id} event={event} onClick={() => setSelectedEvent(event)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event detail overlay */}
      <AnimatePresence>
        {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      </AnimatePresence>
    </div>
  );
}
