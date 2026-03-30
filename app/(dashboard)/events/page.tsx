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
  Phone,
  Envelope,
  CaretLeft,
  Images,
  Receipt,
  Eye,
  Briefcase,
  Target,
} from "@phosphor-icons/react";
import type {
  SalesforceEvent,
  SalesforceOpportunityFull,
  SalesforceLead,
} from "@/lib/salesforce-types";
import type { EnrichedInvoice } from "@/lib/types";
import {
  formatCurrency,
  daysUntil,
  daysSince,
  formatRelativeTime,
  EVENT_CATEGORY_COLORS,
  OPPORTUNITY_STAGES,
  INTEREST_FIELDS,
} from "@/lib/constants";
import { resolveEventImage } from "@/lib/event-images";

// ── Category Visual System ──

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

function getCatStyle(category: string | null) {
  if (!category) return { bg: "bg-muted/15", text: "text-muted-foreground" };
  const key = category.toLowerCase().replace(/\s+/g, "-");
  return EVENT_CATEGORY_COLORS[key] || EVENT_CATEGORY_COLORS[category.toLowerCase()] || { bg: "bg-muted/15", text: "text-muted-foreground" };
}

// ── Helpers ──

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (!e || s.toDateString() === e.toDateString()) return s.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()} – ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
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

// ── Event Card — premium, zero-shift design ──

function EventCard({ event, onClick }: { event: SalesforceEvent; onClick: () => void }) {
  const catVisual = getCategoryVisual(event.Category__c);
  const CatIcon = catVisual.icon;
  const daysLeft = event.Start_Date__c ? daysUntil(event.Start_Date__c) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const imageUrl = event.Event_Image_1__c || resolveEventImage(event.Name) || event.Serper_Image__c;
  const startDate = event.Start_Date__c ? new Date(event.Start_Date__c) : null;

  return (
    <div
      onClick={onClick}
      className={`ab-card group cursor-pointer relative overflow-hidden rounded-xl ${isPast ? "opacity-60 hover:opacity-90" : ""}`}
      style={{ aspectRatio: "3/4" }}
    >
      {/* Image or gradient background — always positioned absolutely */}
      {imageUrl ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover will-change-transform transition-[transform,opacity] duration-700 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
          {/* Single clean gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0">
          <div className={`absolute inset-0 bg-gradient-to-br ${catVisual.gradient}`} />
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06]">
            <CatIcon className="size-48" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
      )}

      {/* Card content — fixed layout, no shifting */}
      <div className="relative z-[2] h-full flex flex-col justify-between p-5">
        {/* Top row: date + category */}
        <div className="flex items-start justify-between">
          {startDate ? (
            <div className="flex flex-col pl-2.5 border-l border-white/80">
              <span className="text-[22px] font-light text-white leading-none tabular-nums">{startDate.getDate()}</span>
              <span className="text-[10px] font-bold tracking-[0.1em] text-white/70 mt-1 uppercase">
                {startDate.toLocaleDateString("en-GB", { month: "short" })}
              </span>
            </div>
          ) : (
            <div />
          )}
          <span className="text-[8px] font-bold tracking-[0.12em] uppercase text-white/90 px-1.5 py-[3px] rounded-[3px] border border-white/20 backdrop-blur-sm bg-black/10">
            {event.Category__c || "Event"}
          </span>
        </div>

        {/* Bottom: title, location, arrow — always laid out, opacity transitions only */}
        <div>
          {/* Title — always visible */}
          <h3 className="text-white font-light leading-[1.12] line-clamp-3 text-[clamp(17px,1.8vw,24px)] mb-2">
            {event.Name}
          </h3>

          {/* Meta row — always occupies space, fades in on hover */}
          <div className="flex items-end justify-between pt-2.5 border-t border-white/[0.12] opacity-0 group-hover:opacity-100 transition-opacity duration-400 ease-out">
            <div className="min-w-0 flex-1">
              {event.Location__r?.Name ? (
                <>
                  <div className="text-[9px] tracking-[0.14em] text-white/35 mb-0.5 uppercase">Location</div>
                  <div className="text-[12px] font-light text-white/80 truncate">{event.Location__r.Name}</div>
                </>
              ) : (
                <>
                  <div className="text-[9px] tracking-[0.14em] text-white/35 mb-0.5 uppercase">Date</div>
                  <div className="text-[12px] font-light text-white/80">{formatDateRange(event.Start_Date__c, event.End_Date__c)}</div>
                </>
              )}
            </div>
            <div className="size-7 rounded-full bg-white flex items-center justify-center shrink-0 ml-3">
              <CaretRight className="size-3 text-black" weight="bold" />
            </div>
          </div>
        </div>
      </div>

      {/* Card border glow — CSS-only, no JS handlers, dual-mode */}
      <style jsx>{`
        .ab-card {
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          transition: border-color 0.5s ease, box-shadow 0.4s ease;
        }
        .ab-card:hover {
          border-color: rgba(0,0,0,0.15);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        :global(.dark) .ab-card {
          border-color: rgba(255,255,255,0.05);
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        :global(.dark) .ab-card:hover {
          border-color: rgba(255,255,255,0.14);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 12px 28px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}

// ── Full-Screen Event Detail ──

// Extract client name from opp name (e.g., "John Smith - Company LTD-003440" → "John Smith")
function clientName(oppName: string): string {
  const dashIdx = oppName.indexOf(" - ");
  return dashIdx > 0 ? oppName.slice(0, dashIdx) : oppName;
}

type EventTab = "overview" | "tickets" | "deals" | "leads" | "financials" | "gallery";

function EventDetail({ event, onClose }: { event: SalesforceEvent; onClose: () => void }) {
  const [opportunities, setOpportunities] = useState<SalesforceOpportunityFull[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EventTab>("overview");

  // Leads
  const [leads, setLeads] = useState<SalesforceLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  // Overdue invoices
  const [overdueInvoices, setOverdueInvoices] = useState<EnrichedInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);

  // Deal drawer
  const [selectedOpp, setSelectedOpp] = useState<SalesforceOpportunityFull | null>(null);

  // Gallery lightbox
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

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

  // Lazy-load leads when tab activated
  useEffect(() => {
    if (activeTab === "leads" && !leadsLoaded) {
      setLeadsLoading(true);
      fetch(`/api/events/${event.Id}/leads`)
        .then((r) => r.json())
        .then((data) => { if (data.success) setLeads(data.data); })
        .catch(console.error)
        .finally(() => { setLeadsLoading(false); setLeadsLoaded(true); });
    }
  }, [activeTab, leadsLoaded, event.Id]);

  // Lazy-load overdue invoices when financials tab activated
  useEffect(() => {
    if (activeTab === "financials" && !invoicesLoaded) {
      setInvoicesLoading(true);
      fetch("/api/xero/invoices")
        .then((r) => { if (r.status === 403) throw new Error("no-access"); return r.json(); })
        .then((data) => {
          if (data.success) {
            const matching = (data.data as EnrichedInvoice[]).filter(
              (inv) => inv.eventName && inv.eventName.toLowerCase() === event.Name.toLowerCase(),
            );
            setOverdueInvoices(matching);
          }
        })
        .catch(() => {})
        .finally(() => { setInvoicesLoading(false); setInvoicesLoaded(true); });
    }
  }, [activeTab, invoicesLoaded, event.Name]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handler); };
  }, [onClose]);

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
  const sfImages = [event.Event_Image_1__c, event.Event_Image_2__c, event.Event_Image_3__c, event.Event_Image_4__c, event.Event_Image_5__c].filter(Boolean) as string[];
  const resolvedImage = sfImages.length === 0 ? resolveEventImage(event.Name) : null;
  const images = sfImages.length > 0 ? sfImages : resolvedImage ? [resolvedImage] : event.Serper_Image__c ? [event.Serper_Image__c] : [];
  const totalCosts = (event.Total_Booking_Cost__c || 0) + (event.Total_Staff_Costs__c || 0);

  const oppsByStage = useMemo(() => {
    const grouped: Record<string, SalesforceOpportunityFull[]> = {};
    for (const opp of opportunities) { if (!grouped[opp.StageName]) grouped[opp.StageName] = []; grouped[opp.StageName].push(opp); }
    return grouped;
  }, [opportunities]);
  const totalOppRevenue = useMemo(() => opportunities.reduce((sum, o) => sum + (o.Gross_Amount__c || o.Amount || 0), 0), [opportunities]);
  const wonOpps = useMemo(() => opportunities.filter((o) => ["Agreement Signed", "Amended", "Amendment Signed"].includes(o.StageName)), [opportunities]);

  const tabs: { id: EventTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "tickets", label: "Tickets" },
    { id: "deals", label: "Deals" },
    { id: "leads", label: "Leads" },
    { id: "financials", label: "Financials" },
    ...(images.length > 1 ? [{ id: "gallery" as EventTab, label: "Gallery" }] : []),
  ];

  // Payment progress helper
  const paymentPct = (pct: number | null) => {
    if (pct == null) return null;
    const p = Math.round(pct);
    if (p >= 100) return { label: "Paid", color: "text-emerald-400" };
    if (p >= 50) return { label: `${p}%`, color: "text-foreground/70" };
    if (p > 0) return { label: `${p}%`, color: "text-amber-400/80" };
    return { label: "0%", color: "text-muted-foreground/50" };
  };

  // Group deals into won vs lost for side-by-side layout
  const wonStages = ["Agreement Signed", "Amended", "Amendment Signed"];
  const lostStages = ["Closed Lost"];
  const wonDeals = useMemo(() => opportunities.filter((o) => wonStages.includes(o.StageName)), [opportunities]);
  const lostDeals = useMemo(() => opportunities.filter((o) => lostStages.includes(o.StageName)), [opportunities]);
  const otherDeals = useMemo(() => opportunities.filter((o) => !wonStages.includes(o.StageName) && !lostStages.includes(o.StageName)), [opportunities]);
  const wonTotal = useMemo(() => wonDeals.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0), [wonDeals]);
  const lostTotal = useMemo(() => lostDeals.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0), [lostDeals]);

  // Embossed card style — reusable, works in both light and dark mode
  const cardCls = "ev-card rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.025]";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-stretch justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="ev-detail-modal w-full max-w-5xl m-6 bg-card rounded-2xl border border-border/40 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Hero — compact with stronger fade */}
        <div className="relative h-52 shrink-0 overflow-hidden">
          {images.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/image-proxy?url=${encodeURIComponent(images[0])}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-black/20" />
            </>
          ) : (
            <>
              <div className={`absolute inset-0 bg-gradient-to-br ${catVisual.gradient}`} />
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]"><CatIcon className="size-56" /></div>
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
            </>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 z-10 size-8 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/50 transition-colors">
            <X className="size-3.5" weight="bold" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-foreground/60 dark:text-white/80 px-1.5 py-[2px] rounded-[3px] border border-border/30 dark:border-white/15 backdrop-blur-sm bg-muted/30 dark:bg-black/10">
                {event.Category__c || "Event"}
              </span>
              {daysLeft !== null && (
                <span className={`text-[10px] font-medium ${isPast ? "text-muted-foreground/60" : daysLeft <= 14 ? "text-amber-400/80" : "text-muted-foreground/40 dark:text-white/40"}`}>
                  {isPast ? "Passed" : `${daysLeft}d away`}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground leading-tight">{event.Name}</h2>
            <div className="flex items-center gap-3 mt-2 text-[13px] text-muted-foreground">
              {event.Location__r?.Name && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{event.Location__r.Name}</span>}
              <span className="flex items-center gap-1.5"><CalendarBlank className="size-4" />{formatDateRange(event.Start_Date__c, event.End_Date__c)}</span>
            </div>
          </div>
        </div>

        {/* Tabs — clean underline */}
        <div className="border-b border-border/30 px-6">
          <div className="flex items-center gap-0">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground/60 hover:text-muted-foreground"}`}>
                {tab.label}
                {tab.id === "deals" && !oppsLoading && opportunities.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground/40 tabular-nums">{opportunities.length}</span>
                )}
                {tab.id === "leads" && leadsLoaded && leads.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground/40 tabular-nums">{leads.length}</span>
                )}
                {tab.id === "gallery" && images.length > 1 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground/40 tabular-nums">{images.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "overview" && (() => {
            // Pipeline donut — proportional by deal count, always fills 100%
            const stageEntries = Object.entries(oppsByStage);
            const donutSegments: { stage: string; value: number; color: string; count: number }[] = stageEntries.map(([stage, opps]) => {
              const sc = OPPORTUNITY_STAGES[stage];
              return { stage, value: opps.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0), color: sc?.color || "#666", count: opps.length };
            });
            const totalDeals = donutSegments.reduce((s, d) => s + d.count, 0);
            const r = 46, cx = 56, cy = 56, stroke = 11;
            const circ = 2 * Math.PI * r;
            const gap = 3;
            let offset = 0;

            return (
              <div className="p-6">
                {/* Financials strip */}
                <div className={`flex items-stretch gap-px rounded-xl overflow-hidden ${cardCls} mb-5`}>
                  {[
                    { label: "Pipeline", value: totalOppRevenue, loading: oppsLoading },
                    { label: "Revenue", value: revenueActual, sub: revenueTarget > 0 ? `${revenuePct}% of target` : undefined },
                    { label: "Payments", value: event.Total_Payments_Received__c || 0 },
                    { label: "Costs", value: totalCosts },
                    { label: "Margin", value: null as number | null, custom: margin != null ? `${margin.toFixed(1)}%` : "—" },
                  ].map((item, i) => (
                    <div key={item.label} className={`flex-1 px-5 py-4 ${i > 0 ? "border-l border-border/20" : ""}`}>
                      <div className="text-[11px] text-muted-foreground/50 font-medium tracking-wide uppercase mb-1.5">{item.label}</div>
                      <div className="text-lg font-bold tabular-nums tracking-tight">
                        {item.loading ? "…" : item.custom || formatCurrency(item.value || 0)}
                      </div>
                      {item.sub && <div className="text-[11px] text-muted-foreground/40 mt-0.5">{item.sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Three-column: Pipeline Donut | Tickets | Leads Summary */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Pipeline Donut — 3D embossed ring */}
                  <div className={`${cardCls} p-5 flex flex-col`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground/40 font-medium">Pipeline</h4>
                      <span className="text-sm text-muted-foreground/40 tabular-nums font-medium">{formatCurrency(donutSegments.reduce((s, d) => s + d.value, 0))}</span>
                    </div>
                    {oppsLoading ? (
                      <div className="flex-1 flex items-center justify-center"><div className="size-24 rounded-full bg-muted/10 animate-pulse" /></div>
                    ) : opportunities.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground/30">No deals</div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="relative donut-glow" style={{ width: 112, height: 112 }}>
                          <svg viewBox="0 0 112 112" className="size-full -rotate-90" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))" }}>
                            {/* Track ring — subtle depth */}
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke + 2} className="text-muted/[0.06]" />
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/[0.04]" />
                            {/* Segments — proportional by deal count, always 100% */}
                            {donutSegments.map((seg) => {
                              const pct = totalDeals > 0 ? seg.count / totalDeals : 0;
                              const dashLen = pct * circ;
                              const dashGap = circ - dashLen;
                              const segGap = donutSegments.length > 1 ? gap : 0;
                              const el = (
                                <circle key={seg.stage} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={stroke}
                                  strokeDasharray={`${Math.max(1, dashLen - segGap)} ${dashGap + segGap}`} strokeDashoffset={-offset}
                                  className="transition-all duration-700"
                                  style={{ filter: `drop-shadow(0 0 6px ${seg.color}40)` }} />
                              );
                              offset += dashLen;
                              return el;
                            })}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold tabular-nums">{opportunities.length}</span>
                            <span className="text-[9px] text-muted-foreground/35 uppercase tracking-[0.15em] font-medium">deals</span>
                          </div>
                        </div>
                        {/* Legend */}
                        <div className="flex flex-col gap-1.5 mt-4 w-full">
                          {donutSegments.map((seg) => (
                            <div key={seg.stage} className="flex items-center justify-between text-[12px]">
                              <div className="flex items-center gap-2">
                                <div className="size-2.5 rounded-full" style={{ backgroundColor: seg.color, boxShadow: `0 0 6px ${seg.color}50` }} />
                                <span className="text-muted-foreground/65">{seg.stage}</span>
                              </div>
                              <span className="text-muted-foreground/40 tabular-nums font-medium">{seg.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tickets Summary */}
                  <div className={`${cardCls} p-5 flex flex-col`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground/40 font-medium">Tickets</h4>
                      <span className="text-sm tabular-nums font-semibold">{totalBooked}<span className="text-muted-foreground/30 font-normal">/{totalRequired}</span></span>
                    </div>
                    <div className="h-2 bg-muted/20 rounded-full overflow-hidden mb-4">
                      <div className={`h-full rounded-full transition-all ${completionPct >= 90 ? "bg-red-400/80" : completionPct >= 50 ? "bg-amber-400/70" : "bg-emerald-400/70"}`} style={{ width: `${completionPct}%` }} />
                    </div>
                    <div className="space-y-2 flex-1">
                      {TICKET_TYPES.map((tt) => {
                        const req = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0;
                        const bkd = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0;
                        if (req === 0) return null;
                        const pct = Math.round((bkd / req) * 100);
                        return (
                          <div key={tt.label} className="flex items-center gap-2.5 text-[12px]">
                            <span className="w-16 text-muted-foreground/50 truncate">{tt.label}</span>
                            <div className="flex-1 h-1.5 bg-muted/15 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400/60" : pct >= 50 ? "bg-amber-400/50" : "bg-emerald-400/50"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-10 text-right tabular-nums text-muted-foreground/40">{bkd}/{req}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Leads Summary */}
                  <div className={`${cardCls} p-5 flex flex-col`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground/40 font-medium">Leads</h4>
                      {leadsLoaded && <span className="text-sm tabular-nums font-semibold">{leads.length}</span>}
                    </div>
                    {!leadsLoaded ? (
                      <div className="flex-1 flex items-center justify-center">
                        <button onClick={() => setActiveTab("leads")} className="text-sm text-primary/60 hover:text-primary transition-colors">
                          View leads →
                        </button>
                      </div>
                    ) : leads.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground/30">No leads matched</div>
                    ) : (
                      <div className="flex-1 flex flex-col">
                        <div className="space-y-2 flex-1">
                          {leads.slice(0, 5).map((lead) => (
                            <div key={lead.Id} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-[13px] font-medium truncate block text-foreground/70">{lead.Name}</span>
                                {lead.Company && <span className="text-[11px] text-muted-foreground/35 truncate block">{lead.Company}</span>}
                              </div>
                              <span className="text-[10px] font-medium px-1.5 py-[2px] rounded bg-muted/25 text-muted-foreground/50 shrink-0">{lead.Status}</span>
                            </div>
                          ))}
                        </div>
                        {leads.length > 5 && (
                          <button onClick={() => setActiveTab("leads")} className="text-xs text-primary/60 hover:text-primary mt-3 transition-colors">
                            +{leads.length - 5} more leads →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === "tickets" && (
            <div className="p-6 space-y-4">
              <div className={`${cardCls} p-6`}>
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-base font-semibold">Ticket Inventory</h4>
                  <span className="text-base tabular-nums font-bold">{totalBooked}/{totalRequired} <span className="text-muted-foreground/50 font-normal text-sm">({Math.round(completionPct)}%)</span></span>
                </div>
                <div className="h-2 bg-muted/15 rounded-full overflow-hidden mb-5">
                  <div className={`h-full rounded-full transition-all ${completionPct >= 90 ? "bg-red-400/80" : completionPct >= 70 ? "bg-amber-400/70" : "bg-emerald-400/70"}`} style={{ width: `${completionPct}%` }} />
                </div>
                <div className="space-y-2.5">
                  {TICKET_TYPES.map((tt) => {
                    const req = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0;
                    const bkd = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0;
                    return <TicketBar key={tt.label} label={tt.label} icon={tt.icon} required={req} booked={bkd} />;
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "deals" && (
            <div className="p-6">
              {oppsLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/10 animate-pulse" />)}</div>
              ) : opportunities.length === 0 ? (
                <p className="text-center text-muted-foreground/50 py-16 text-sm">No deals linked to this event</p>
              ) : (
                <div className="space-y-5">
                  {(wonDeals.length > 0 || lostDeals.length > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Won column */}
                      <div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400/80" weight="fill" />
                            <span className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400/80">Won</span>
                          </div>
                          <span className="text-[13px] text-muted-foreground/35 tabular-nums">{wonDeals.length} · {formatCurrency(wonTotal)}</span>
                        </div>
                        <div className="space-y-2.5">
                          {wonDeals.length > 0 ? wonDeals.map((opp) => {
                            const amount = opp.Gross_Amount__c || opp.Amount || 0;
                            const pp = paymentPct(opp.Percentage_Paid__c);
                            return (
                              <div key={opp.Id} className={`${cardCls} px-5 py-4 cursor-pointer hover:border-foreground/10 transition-all`} onClick={() => setSelectedOpp(opp)}>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <span className="text-[15px] font-semibold truncate">{clientName(opp.Name)}</span>
                                  <span className="text-[17px] font-bold tabular-nums shrink-0">{formatCurrency(amount)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[13px] text-foreground/45 truncate">
                                    {opp.Account?.Name}{opp.Owner?.Name && ` · ${opp.Owner.Name}`}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {opp.Total_Number_of_Guests__c != null && opp.Total_Number_of_Guests__c > 0 && (
                                      <span className="text-[12px] text-foreground/30 flex items-center gap-1"><Users className="size-3.5" />{opp.Total_Number_of_Guests__c}</span>
                                    )}
                                    {pp && <span className={`text-[13px] font-semibold tabular-nums ${pp.color}`}>{pp.label}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          }) : (
                            <div className={`${cardCls} px-5 py-6 text-center`}>
                              <span className="text-sm text-muted-foreground/25">No won deals</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lost column */}
                      <div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="flex items-center gap-1.5">
                            <X className="size-3.5 text-red-500 dark:text-red-400/70" weight="bold" />
                            <span className="text-[12px] font-semibold text-red-500 dark:text-red-400/70">Lost</span>
                          </div>
                          <span className="text-[13px] text-muted-foreground/35 tabular-nums">{lostDeals.length} · {formatCurrency(lostTotal)}</span>
                        </div>
                        <div className="space-y-2">
                          {lostDeals.length > 0 ? lostDeals.map((opp) => {
                            const amount = opp.Gross_Amount__c || opp.Amount || 0;
                            return (
                              <div key={opp.Id} className={`${cardCls} px-5 py-4 cursor-pointer hover:border-foreground/10 transition-all`} onClick={() => setSelectedOpp(opp)}>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <span className="text-[15px] font-semibold truncate">{clientName(opp.Name)}</span>
                                  <span className="text-[17px] font-bold tabular-nums shrink-0">{formatCurrency(amount)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[13px] text-foreground/45 truncate">
                                    {opp.Account?.Name}{opp.Owner?.Name && ` · ${opp.Owner.Name}`}
                                  </span>
                                  {opp.Loss_Reason__c && <span className="text-[11px] text-foreground/30 truncate max-w-[140px]">{opp.Loss_Reason__c}</span>}
                                </div>
                              </div>
                            );
                          }) : (
                            <div className={`${cardCls} px-5 py-6 text-center`}>
                              <span className="text-sm text-muted-foreground/25">No lost deals</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* In progress */}
                  {otherDeals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-blue-500 dark:text-blue-400/70" />
                          <span className="text-sm font-semibold text-blue-500 dark:text-blue-400/70">In Progress</span>
                        </div>
                        <span className="text-[13px] text-muted-foreground/35 tabular-nums">
                          {otherDeals.length} · {formatCurrency(otherDeals.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0))}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {otherDeals.map((opp) => {
                          const amount = opp.Gross_Amount__c || opp.Amount || 0;
                          const pp = paymentPct(opp.Percentage_Paid__c);
                          const sc = OPPORTUNITY_STAGES[opp.StageName];
                          return (
                            <div key={opp.Id} className={`${cardCls} px-5 py-4 cursor-pointer hover:border-foreground/10 transition-all`} onClick={() => setSelectedOpp(opp)}>
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <span className="text-[15px] font-semibold truncate">{clientName(opp.Name)}</span>
                                <span className="text-[17px] font-bold tabular-nums shrink-0">{formatCurrency(amount)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[13px] text-foreground/45 truncate">
                                  {opp.Account?.Name}{opp.Owner?.Name && ` · ${opp.Owner.Name}`}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {pp && <span className={`text-[13px] font-semibold tabular-nums ${pp.color}`}>{pp.label}</span>}
                                  <span className={`text-[11px] px-2 py-[3px] rounded-md font-medium ${sc?.bgColor || "bg-muted/20 text-muted-foreground"}`}>
                                    {opp.StageName}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "financials" && (
            <div className="p-6">
              {/* 50/50 split — Revenue left, Profitability right */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Revenue */}
                <div className={`${cardCls} p-5`}>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground/40 font-medium mb-4">Revenue</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground/60">Pipeline value</span>
                      <span className="text-[15px] font-bold tabular-nums">{oppsLoading ? "…" : formatCurrency(totalOppRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground/60">Closed won</span>
                      <span className="text-[15px] font-bold tabular-nums">{formatCurrency(revenueActual)}</span>
                    </div>
                    {revenueTarget > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground/60">Target</span>
                        <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(revenueTarget)} <span className="text-muted-foreground/30 font-normal text-[11px]">({revenuePct}%)</span></span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-border/20">
                      <span className="text-sm text-muted-foreground/60">Payments received</span>
                      <span className="text-[14px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400/80">{formatCurrency(event.Total_Payments_Received__c || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Profitability */}
                <div className={`${cardCls} p-5`}>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground/40 font-medium mb-4">Profitability</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground/60">Margin</span>
                      <span className={`text-[14px] font-bold tabular-nums ${margin != null && margin >= 30 ? "text-emerald-600 dark:text-emerald-400/80" : margin != null && margin >= 15 ? "text-amber-500 dark:text-amber-400/80" : ""}`}>
                        {margin != null ? `${margin.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    {event.Total_Margin_Value__c != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground/60">Margin value</span>
                        <span className="text-[15px] font-bold tabular-nums">{formatCurrency(event.Total_Margin_Value__c)}</span>
                      </div>
                    )}
                    {!oppsLoading && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground/60">Deals</span>
                        <span className="text-[13px] tabular-nums font-medium">{wonOpps.length} won <span className="text-muted-foreground/30">/ {opportunities.length} total</span></span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-border/20">
                      <span className="text-sm text-muted-foreground/60">Total costs</span>
                      <span className="text-[15px] font-bold tabular-nums">{formatCurrency(totalCosts)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Costs breakdown — only if there are costs */}
              {totalCosts > 0 && (
                <div className={`${cardCls} p-5`}>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground/40 font-medium mb-4">Cost Breakdown</h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {event.Total_Booking_Cost__c != null && event.Total_Booking_Cost__c > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground/60">Booking costs</span>
                        <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(event.Total_Booking_Cost__c)}</span>
                      </div>
                    )}
                    {event.Total_Staff_Costs__c != null && event.Total_Staff_Costs__c > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground/60">Staff costs</span>
                        <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(event.Total_Staff_Costs__c)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Overdue Invoices — linked to this event */}
              {invoicesLoading ? (
                <div className="space-y-2 mt-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/10 animate-pulse" />)}</div>
              ) : overdueInvoices.length > 0 && (
                <div className={`${cardCls} p-5 mt-4`}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-medium flex items-center gap-1.5">
                      <Receipt className="size-3.5" />Overdue Invoices
                    </h4>
                    <span className="text-[11px] text-red-400/70 tabular-nums font-medium">
                      {overdueInvoices.length} · {formatCurrency(overdueInvoices.reduce((s, inv) => s + (inv.AmountDue || 0), 0))}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {overdueInvoices.map((inv) => {
                      const days = inv.daysOverdue || 0;
                      const severity = days >= 90 ? "text-red-400 bg-red-500/10" : days >= 30 ? "text-orange-400 bg-orange-500/10" : "text-amber-400 bg-amber-500/10";
                      return (
                        <div key={inv.InvoiceID} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                          <div className="min-w-0 flex-1">
                            <span className="text-[12px] font-medium truncate block">{inv.Contact?.Name}</span>
                            <span className="text-[10px] text-muted-foreground/35 font-mono">{inv.InvoiceNumber}</span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className={`text-[9px] font-semibold px-1.5 py-[2px] rounded ${severity}`}>{days}d overdue</span>
                            {inv.chaseStage?.stage && (
                              <span className="text-[9px] text-muted-foreground/40 px-1.5 py-[2px] rounded bg-muted/20">
                                {inv.chaseStage.stage.split("_").slice(0, 2).join(" ")}
                              </span>
                            )}
                            <span className="text-[13px] font-bold tabular-nums text-red-400">{formatCurrency(inv.AmountDue || 0)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Leads Tab ── */}
          {activeTab === "leads" && (
            <div className="p-6">
              {leadsLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted/10 animate-pulse" />)}</div>
              ) : leads.length === 0 ? (
                <div className="text-center py-16">
                  <Target className="size-10 mx-auto text-muted-foreground/15 mb-3" />
                  <p className="text-sm text-muted-foreground/50">No leads matched for this event</p>
                  <p className="text-[11px] text-muted-foreground/30 mt-1">Leads are matched by event of interest or category</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground/40 font-medium">Potential Leads</h4>
                      <span className="text-xs text-muted-foreground/30 tabular-nums">{leads.length}</span>
                    </div>
                    <span className="text-xs text-muted-foreground/25">Matched by interest or event name</span>
                  </div>
                  <div className="space-y-2.5">
                    {leads.map((lead) => {
                      const interests = Object.entries(INTEREST_FIELDS).filter(([field]) => lead[field as keyof SalesforceLead] === true);
                      return (
                        <div key={lead.Id} className={`${cardCls} px-5 py-4`}>
                          {/* Row 1: Name + status + guests */}
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-[15px] font-semibold truncate">{lead.Name}</span>
                              {lead.Company && (
                                <span className="text-[13px] text-muted-foreground/50 truncate hidden lg:block">{lead.Company}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {lead.No_of_Guests__c != null && lead.No_of_Guests__c > 0 && (
                                <span className="text-[13px] text-foreground/60 flex items-center gap-1"><Users className="size-4" />{lead.No_of_Guests__c}</span>
                              )}
                              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-muted/25 text-foreground/50">{lead.Status}</span>
                            </div>
                          </div>
                          {/* Row 2: Phone + email */}
                          <div className="flex items-center gap-5 mb-2.5">
                            {lead.Phone && (
                              <a href={`tel:${lead.Phone}`} className="text-[13px] text-foreground/50 hover:text-foreground flex items-center gap-1.5 transition-colors">
                                <Phone className="size-4 text-foreground/30" />{lead.Phone}
                              </a>
                            )}
                            {lead.Email && (
                              <a href={`mailto:${lead.Email}`} className="text-[13px] text-foreground/50 hover:text-foreground flex items-center gap-1.5 truncate transition-colors">
                                <Envelope className="size-4 text-foreground/30" />{lead.Email}
                              </a>
                            )}
                          </div>
                          {/* Row 3: Interest tags + owner */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              {interests.slice(0, 4).map(([, cfg]) => (
                                <span key={cfg.label} className="text-[11px] font-medium px-2 py-[3px] rounded-md bg-foreground/[0.06] text-foreground/45">
                                  {cfg.label}
                                </span>
                              ))}
                              {interests.length > 4 && <span className="text-[11px] text-foreground/25">+{interests.length - 4}</span>}
                            </div>
                            {lead.Owner?.Name && (
                              <span className="text-[12px] text-foreground/35">{lead.Owner.Name}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Gallery Tab ── */}
          {activeTab === "gallery" && (
            <div className="p-6">
              {images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images.map((url, i) => (
                    <div key={i} onClick={() => setLightboxIdx(i)} className={`${cardCls} overflow-hidden cursor-pointer group`}>
                      <div className="aspect-[3/2] relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(url)}`}
                          alt={`${event.Name} - Image ${i + 1}`}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Images className="size-10 mx-auto text-muted-foreground/15 mb-3" />
                  <p className="text-sm text-muted-foreground/50">No images available</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Mini Deal Drawer ── */}
        <AnimatePresence>
          {selectedOpp && (
            <>
              {/* Click-off backdrop */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/20 z-40" onClick={() => setSelectedOpp(null)} />
              <motion.div
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 right-0 w-[420px] bg-card border-l border-border/40 shadow-2xl z-50 flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header — prominent name + stage */}
                <div className="px-7 pt-7 pb-6 border-b border-border/20">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-xl font-bold leading-tight">{clientName(selectedOpp.Name)}</h3>
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 ${OPPORTUNITY_STAGES[selectedOpp.StageName]?.bgColor || "bg-muted/20 text-muted-foreground"}`}>
                      {selectedOpp.StageName}
                    </span>
                  </div>
                  {selectedOpp.Account?.Name && <p className="text-[15px] text-muted-foreground/55">{selectedOpp.Account.Name}</p>}
                </div>

                <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">
                  {/* Key metrics — clean, large */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`${cardCls} p-5`}>
                      <div className="text-[11px] uppercase tracking-wider text-foreground/30 mb-2">Amount</div>
                      <div className="text-xl font-bold tabular-nums">{formatCurrency(selectedOpp.Gross_Amount__c || selectedOpp.Amount || 0)}</div>
                    </div>
                    <div className={`${cardCls} p-5`}>
                      <div className="text-[11px] uppercase tracking-wider text-foreground/30 mb-2">Payment</div>
                      <div className="text-xl font-bold tabular-nums">{selectedOpp.Percentage_Paid__c != null ? `${Math.round(selectedOpp.Percentage_Paid__c)}%` : "—"}</div>
                    </div>
                    {selectedOpp.Total_Balance__c != null && selectedOpp.Total_Balance__c > 0 && (
                      <div className={`${cardCls} p-5`}>
                        <div className="text-[11px] uppercase tracking-wider text-foreground/30 mb-2">Outstanding</div>
                        <div className="text-xl font-bold tabular-nums text-foreground/70">{formatCurrency(selectedOpp.Total_Balance__c)}</div>
                      </div>
                    )}
                    {selectedOpp.Total_Number_of_Guests__c != null && selectedOpp.Total_Number_of_Guests__c > 0 && (
                      <div className={`${cardCls} p-5`}>
                        <div className="text-[11px] uppercase tracking-wider text-foreground/30 mb-2">Guests</div>
                        <div className="text-xl font-bold tabular-nums">{selectedOpp.Total_Number_of_Guests__c}</div>
                      </div>
                    )}
                  </div>

                  {/* Details — clean monochrome */}
                  <div className="space-y-5">
                    {selectedOpp.Package_Sold__r?.Name && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-foreground/30 mb-2">Package</div>
                        <div className="text-[15px] text-foreground/75 leading-relaxed">{selectedOpp.Package_Sold__r.Name}</div>
                      </div>
                    )}
                    {selectedOpp.NextStep && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-foreground/30 mb-2">Next Step</div>
                        <div className="text-[15px] text-foreground/75">{selectedOpp.NextStep}</div>
                      </div>
                    )}
                    {selectedOpp.Special_Requirements__c && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-foreground/30 mb-2">Special Requirements</div>
                        <div className="text-[15px] text-foreground/75 leading-relaxed">{selectedOpp.Special_Requirements__c}</div>
                      </div>
                    )}
                    {selectedOpp.Loss_Reason__c && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-foreground/25 mb-2">Loss Reason</div>
                        <div className="text-[15px] text-foreground/55">{selectedOpp.Loss_Reason__c}</div>
                      </div>
                    )}
                  </div>

                  {/* Meta card */}
                  <div className={`${cardCls} p-5 space-y-4`}>
                    {selectedOpp.Owner?.Name && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground/35">Owner</span>
                        <span className="text-sm text-foreground/70 flex items-center gap-1.5"><UserCircle className="size-4 text-foreground/30" />{selectedOpp.Owner.Name}</span>
                      </div>
                    )}
                    {selectedOpp.Opportunity_Contact__r?.Name && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground/35">Contact</span>
                        <span className="text-sm text-foreground/70">{selectedOpp.Opportunity_Contact__r.Name}</span>
                      </div>
                    )}
                    {selectedOpp.LeadSource && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground/35">Source</span>
                        <span className="text-sm text-foreground/70">{selectedOpp.LeadSource}</span>
                      </div>
                    )}
                    {selectedOpp.LastActivityDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground/35">Last Activity</span>
                        <span className="text-sm text-foreground/70">{formatRelativeTime(selectedOpp.LastActivityDate)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Lightbox ── */}
        <AnimatePresence>
          {lightboxIdx !== null && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
              onClick={() => setLightboxIdx(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/image-proxy?url=${encodeURIComponent(images[lightboxIdx])}`}
                alt=""
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + images.length) % images.length); }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                  >
                    <CaretLeft className="size-5" weight="bold" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % images.length); }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                  >
                    <CaretRight className="size-5" weight="bold" />
                  </button>
                </>
              )}
              <button
                onClick={() => setLightboxIdx(null)}
                className="absolute top-6 right-6 size-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X className="size-4" weight="bold" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Embossed card + modal styling — dual mode */}
        <style jsx>{`
          :global(.ev-detail-modal) {
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
          }
          :global(.dark .ev-detail-modal) {
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03);
          }
          :global(.ev-card) {
            box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6);
          }
          :global(.dark .ev-card) {
            box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.03);
          }
          :global(.donut-glow) {
            filter: drop-shadow(0 0 20px rgba(34,197,94,0.12));
          }
          :global(.dark .donut-glow) {
            filter: drop-shadow(0 0 24px rgba(34,197,94,0.18));
          }
        `}</style>
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
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Record<string, HTMLElement | null>>({});

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

  const sortedMonthKeys = useMemo(() => Object.keys(eventsByMonth).sort(), [eventsByMonth]);

  // Scroll spy: detect which month section is visible
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const headerHeight = 64; // sticky header
      let activeMonth = "";

      for (const key of sortedMonthKeys) {
        const el = monthRefs.current[key];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;

        if (relativeTop <= headerHeight + 40) {
          activeMonth = key;
        }
      }

      if (activeMonth && activeMonth !== currentMonth) {
        setCurrentMonth(activeMonth);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Initial detection
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [sortedMonthKeys, currentMonth]);

  // Set initial month when data loads
  useEffect(() => {
    if (sortedMonthKeys.length > 0 && !currentMonth) {
      setCurrentMonth(sortedMonthKeys[0]);
    }
  }, [sortedMonthKeys, currentMonth]);

  const formatMonthLabel = (yyyyMM: string) => {
    if (!yyyyMM) return "";
    const [y, m] = yyyyMM.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  };

  const formatMonthName = (yyyyMM: string) => {
    if (!yyyyMM) return "Events";
    const [y, m] = yyyyMM.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString("en-GB", { month: "long" });
  };

  const formatYear = (yyyyMM: string) => {
    if (!yyyyMM) return "";
    return yyyyMM.split("-")[0];
  };

  return (
    <div ref={scrollRef} className="h-dvh overflow-y-auto bg-background p-4 pl-24 lg:p-5 lg:pl-24">
      <div className="max-w-[1600px] mx-auto pb-24">

        {/* ── Sticky Header — Glassmorphic pill ── */}
        <div className="sticky top-0 z-20 pt-2 pb-3 flex justify-center">
          <div
            className="ev-header rounded-full px-6 py-3 flex items-center gap-3 w-auto"
            style={{
              background: "rgba(20, 20, 20, 0.55)",
              backdropFilter: "blur(32px) saturate(1.6)",
              WebkitBackdropFilter: "blur(32px) saturate(1.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 0 0 0.5px rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.4), 0 10px 28px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)",
            }}
          >
            {/* Month title */}
            <div className="flex items-baseline shrink-0 overflow-hidden" style={{ width: "155px" }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={currentMonth}
                  initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="text-[15px] font-bold text-foreground tracking-tight whitespace-nowrap"
                >
                  {loading ? "Events" : `${formatMonthName(currentMonth)} ${formatYear(currentMonth)}`}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-border/25 shrink-0" />

            {/* Search */}
            <div className="relative w-44">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/35" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events..."
                className="ev-input w-full pl-8 pr-7 py-1.5 rounded-full text-[12px] text-foreground placeholder:text-muted-foreground/30 outline-none ring-0 focus:outline-none focus:ring-0 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5">
                  <X className="size-3 text-muted-foreground/40 hover:text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Category dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="ev-select appearance-none pl-3 pr-7 py-1.5 rounded-full text-[12px] font-medium outline-none ring-0 focus:outline-none focus:ring-0 cursor-pointer transition-all"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40 pointer-events-none" weight="bold" />
            </div>

            {/* Past toggle */}
            <button
              onClick={() => setShowPastEvents(!showPastEvents)}
              className={`ev-toggle px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                !showPastEvents ? "active" : ""
              }`}
            >
              {showPastEvents ? "Hide Past" : "Show Past"}
            </button>

            {/* Refresh */}
            <button
              onClick={() => { setLoading(true); fetchEvents(); }}
              className="ev-toggle size-7 rounded-full flex items-center justify-center transition-all"
            >
              <ArrowsClockwise className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Events — month sections ── */}
        <div className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
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
            <div className="space-y-14">
              {sortedMonthKeys.map((monthKey) => {
                const monthEvents = eventsByMonth[monthKey];
                return (
                  <section
                    key={monthKey}
                    ref={(el) => { monthRefs.current[monthKey] = el; }}
                    data-month={monthKey}
                  >
                    {/* Month header — elegant inline */}
                    <div className="flex items-baseline gap-4 mb-5">
                      <h2 className="text-2xl font-bold tracking-tight">{formatMonthLabel(monthKey)}</h2>
                      <span className="text-xs text-muted-foreground/40 tabular-nums">{monthEvents.length}</span>
                      <div className="flex-1 h-px bg-border/20 self-center" />
                    </div>

                    {/* Card grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {monthEvents.map((event) => (
                        <EventCard key={event.Id} event={event} onClick={() => setSelectedEvent(event)} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Event detail overlay */}
      <AnimatePresence>
        {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      </AnimatePresence>

      {/* Theme-aware styles */}
      <style jsx>{`
        /* ev-header styles applied via inline style for backdrop-filter compatibility */

        /* ── Search input — recessed pill ── */
        .ev-input {
          background: rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.07);
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .ev-input:focus {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.14);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03), 0 0 0 3px rgba(0, 0, 0, 0.04);
        }
        :global(.dark) .ev-input {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.07);
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        :global(.dark) .ev-input:focus {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.14);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12), 0 0 0 3px rgba(255, 255, 255, 0.04);
        }

        /* ── Category dropdown — raised pill with caret ── */
        .ev-select {
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.08);
          color: rgba(0, 0, 0, 0.55);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          transition: all 0.2s ease;
        }
        .ev-select:hover {
          background: rgba(0, 0, 0, 0.06);
          border-color: rgba(0, 0, 0, 0.12);
          color: rgba(0, 0, 0, 0.7);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
        }
        .ev-select:focus {
          border-color: rgba(0, 0, 0, 0.16);
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
        }
        :global(.dark) .ev-select {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.5);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        :global(.dark) .ev-select:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.14);
          color: rgba(255, 255, 255, 0.7);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
        }
        :global(.dark) .ev-select:focus {
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
        }

        /* ── Toggle buttons — pill capsules ── */
        .ev-toggle {
          color: rgba(0, 0, 0, 0.35);
          border: 1px solid transparent;
        }
        .ev-toggle:hover {
          color: rgba(0, 0, 0, 0.65);
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.07);
        }
        .ev-toggle.active {
          color: rgba(0, 0, 0, 0.85);
          background: rgba(0, 0, 0, 0.08);
          border-color: rgba(0, 0, 0, 0.1);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
        }
        :global(.dark) .ev-toggle {
          color: rgba(255, 255, 255, 0.3);
          border-color: transparent;
        }
        :global(.dark) .ev-toggle:hover {
          color: rgba(255, 255, 255, 0.65);
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.09);
        }
        :global(.dark) .ev-toggle.active {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.16);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
}
