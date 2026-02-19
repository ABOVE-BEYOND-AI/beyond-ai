"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@phosphor-icons/react";
import type { SalesforceEvent } from "@/lib/salesforce-types";
import { formatCurrency, daysUntil, EVENT_CATEGORY_COLORS } from "@/lib/constants";

interface EventItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  category: string;
  imageUrl?: string;
}

// ── Ticket Inventory Types ──

const TICKET_TYPES = [
  { label: "Event", icon: Ticket, requiredField: "Event_Tickets_Required__c", bookedField: "Event_Tickets_Booked__c", remainingField: "Event_Tickets_Remaining__c" },
  { label: "Hospitality", icon: Package, requiredField: "Hospitality_Tickets_Required__c", bookedField: "Hospitality_Tickets_Booked__c", remainingField: "Hospitality_Tickets_Remaining__c" },
  { label: "Hotel", icon: Bed, requiredField: "Hotel_Tickets_Required__c", bookedField: "Hotel_Tickets_Booked__c", remainingField: "Hotel_Tickets_Remaining__c" },
  { label: "Dinner", icon: ForkKnife, requiredField: "Dinner_Tickets_Required__c", bookedField: "Dinner_Tickets_Booked__c", remainingField: "Dinner_Tickets_Remaining__c" },
  { label: "Drinks", icon: Martini, requiredField: "Drinks_Tickets_Required__c", bookedField: "Drinks_Tickets_Booked__c", remainingField: "Drinks_Tickets_Remaining__c" },
  { label: "Party", icon: Confetti, requiredField: "Party_Tickets_Required__c", bookedField: "Party_Tickets_Booked__c", remainingField: "Party_Tickets_Remaining__c" },
  { label: "Flights In", icon: AirplaneLanding, requiredField: "Inbound_Flight_Tickets_Required__c", bookedField: "Inbound_Flight_Tickets_Booked__c", remainingField: "Inbound_Flights_Tickets_Remaining__c" },
  { label: "Flights Out", icon: AirplaneTakeoff, requiredField: "Outbound_Flight_Tickets_Required__c", bookedField: "Outbound_Flight_Tickets_Booked__c", remainingField: "Outbound_Flights_Tickets_Remaining__c" },
  { label: "Transfers In", icon: Car, requiredField: "Inbound_Transfer_Tickets_Required__c", bookedField: "Inbound_Transfer_Tickets_Booked__c", remainingField: "Inbound_Transfer_Tickets_Remaining__c" },
  { label: "Transfers Out", icon: Car, requiredField: "Outbound_Transfer_Tickets_Required__c", bookedField: "Outbound_Transfer_Tickets_Booked__c", remainingField: "Outbound_Transfer_Tickets_Remaining__c" },
] as const;

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
      <span className="w-14 text-right tabular-nums text-muted-foreground">
        {booked}/{required}
      </span>
      {pct >= 80 && (
        <Warning className="size-3.5 text-amber-400 shrink-0" weight="fill" />
      )}
    </div>
  );
}

function InventoryCard({ event, index }: { event: SalesforceEvent; index: number }) {
  const catKey = (event.Category__c || "").toLowerCase().replace(/\s+/g, "-");
  const catStyle = EVENT_CATEGORY_COLORS[catKey] || EVENT_CATEGORY_COLORS[event.Category__c || ""] || { bg: "bg-muted/15", text: "text-muted-foreground" };
  const daysLeft = event.Start_Date__c ? daysUntil(event.Start_Date__c) : null;
  const revenueTarget = event.Revenue_Target__c || 0;
  const revenueActual = event.Sum_of_Closed_Won_Gross__c || 0;
  const revenuePct = revenueTarget > 0 ? Math.min(100, Math.round((revenueActual / revenueTarget) * 100)) : 0;
  const margin = event.Margin_Percentage__c;
  const totalBooked = event.Total_Tickets_Booked__c || 0;
  const totalRequired = event.Total_Tickets_Required__c || 0;
  const completionPct = event.Percentage_Reservations_Completion__c || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${catStyle.bg} ${catStyle.text}`}>
                  {event.Category__c || "Event"}
                </span>
                <h3 className="text-sm font-semibold truncate">{event.Name}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {event.Location__r?.Name && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {event.Location__r.Name}
                  </span>
                )}
                {event.Start_Date__c && (
                  <span className="flex items-center gap-1">
                    <CalendarBlank className="size-3" />
                    {new Date(event.Start_Date__c).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            {daysLeft !== null && (
              <div className={`shrink-0 text-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                daysLeft <= 0 ? "bg-muted/30 text-muted-foreground" : daysLeft <= 7 ? "bg-red-500/15 text-red-400" : daysLeft <= 30 ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
              }`}>
                {daysLeft <= 0 ? "Passed" : `${daysLeft}d`}
              </div>
            )}
          </div>

          {/* Revenue + Margin row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-muted/10 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CurrencyGbp className="size-3.5 text-emerald-400" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Revenue</span>
              </div>
              <div className="text-sm font-bold tabular-nums">{formatCurrency(revenueActual)}</div>
              {revenueTarget > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    of {formatCurrency(revenueTarget)} target
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${revenuePct >= 100 ? "bg-emerald-500" : revenuePct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                      style={{ width: `${revenuePct}%` }}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="rounded-lg bg-muted/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Margin</div>
              <div className={`text-sm font-bold tabular-nums ${
                margin != null && margin >= 30 ? "text-emerald-400" : margin != null && margin >= 15 ? "text-amber-400" : "text-red-400"
              }`}>
                {margin != null ? `${margin.toFixed(1)}%` : "—"}
              </div>
              {event.Total_Margin_Value__c != null && (
                <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {formatCurrency(event.Total_Margin_Value__c)}
                </div>
              )}
            </div>
          </div>

          {/* Ticket inventory */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Ticket Inventory
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {totalBooked}/{totalRequired} ({Math.round(completionPct)}%)
              </span>
            </div>
            <div className="space-y-1.5">
              {TICKET_TYPES.map((tt) => {
                const required = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0;
                const booked = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0;
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

          {/* Staff assignments */}
          {(event.A_B_On_Site_1__c || event.A_B_On_Site_2__c) && (
            <div className="flex items-center gap-2 pt-3 border-t border-border/30">
              <UserCircle className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {[event.A_B_On_Site_1__c, event.A_B_On_Site_2__c].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function InventoryView({ events, loading }: { events: SalesforceEvent[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 bg-card/30 p-5 animate-pulse">
            <div className="h-5 w-48 bg-muted/50 rounded mb-3" />
            <div className="h-3 w-32 bg-muted/30 rounded mb-4" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="h-20 bg-muted/20 rounded-lg" />
              <div className="h-20 bg-muted/20 rounded-lg" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-muted/20 rounded" />
              <div className="h-3 bg-muted/20 rounded" />
              <div className="h-3 bg-muted/20 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground text-center py-12">No event inventory data available.</p>;
  }

  // Sort: upcoming events first (by start date), passed events at the end
  const sorted = [...events].sort((a, b) => {
    const da = a.Start_Date__c || "";
    const db = b.Start_Date__c || "";
    return da.localeCompare(db);
  });

  // Scarcity alerts
  const scarcityEvents = sorted.filter((e) => {
    const pct = e.Percentage_Reservations_Completion__c || 0;
    return pct >= 80 && (e.Total_Tickets_Remaining__c || 0) > 0;
  });

  return (
    <div>
      {/* Scarcity alerts */}
      {scarcityEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Warning className="size-4 text-amber-400" weight="fill" />
            <span className="text-sm font-medium text-amber-400">Low Inventory Alerts</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {scarcityEvents.map((e) => (
              <span key={e.Id} className="text-xs bg-amber-500/10 text-amber-300/80 px-2.5 py-1 rounded-full">
                {e.Name} — {e.Total_Tickets_Remaining__c} remaining ({Math.round(e.Percentage_Reservations_Completion__c || 0)}% full)
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sorted.map((event, i) => (
          <InventoryCard key={event.Id} event={event} index={i} />
        ))}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const selectedCategory = "all" as const;
  const [view, setView] = useState<"grid" | "list" | "inventory">("grid");
  const [inventoryEvents, setInventoryEvents] = useState<SalesforceEvent[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const todayStr = new Date().toISOString().slice(0, 10);

  // Local month cache for instant view switching
  const cacheRef = useRef<Map<string, EventItem[]>>(new Map())

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams();
        params.set("limit", "500");
        params.set("month", month);
        if (selectedCategory !== "all") params.set("category", selectedCategory);
        if (query.trim()) params.set("q", query.trim());
        const viewFields = view === 'grid' ? 'grid' : 'list'
        params.set('fields', viewFields)
        // If month cached and no search/category, show instantly
        const simpleKey = `${month}|${viewFields}`
        if (!query && selectedCategory === 'all' && cacheRef.current.has(simpleKey)) {
          setItems(cacheRef.current.get(simpleKey) as EventItem[])
        }
        const res = await fetch(`/api/events?${params.toString()}`);
        const data = await res.json();
        const raw: EventItem[] = data.items || [];
        // De-duplicate by (name + start + end)
        const seen = new Map<string, EventItem>();
        for (const ev of raw) {
          const k = `${ev.name}|${ev.startDate}|${ev.endDate}`;
          if (!seen.has(k)) seen.set(k, ev);
        }
        const deduped = Array.from(seen.values())
        setItems(deduped);
        if (!query && selectedCategory === 'all') cacheRef.current.set(simpleKey, deduped)
      } catch (e) {
        console.error('Failed to load events', e)
        setError("Failed to load events");
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    run();
  }, [month, query, view]);

  // Prefetch adjacent months on idle
  useEffect(() => {
    type WindowWithRIC = Window & { requestIdleCallback?: (cb: IdleRequestCallback) => number; cancelIdleCallback?: (handle: number) => void }
    const w = window as WindowWithRIC
    const id = w.requestIdleCallback?.(async () => {
      const [y, m] = month.split('-').map(Number)
      const prev = new Date(Date.UTC(y, m - 2, 1))
      const next = new Date(Date.UTC(y, m, 1))
      for (const d of [prev, next]) {
        const mm = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        const key = `${mm}|grid`
        if (cacheRef.current.has(key)) continue
        try {
          const res = await fetch(`/api/events?month=${mm}&limit=500&fields=grid`)
          const data = await res.json()
          if (Array.isArray(data.items)) cacheRef.current.set(key, data.items)
        } catch {}
      }
    })
    return () => w.cancelIdleCallback?.(id as number)
  }, [month])

  // Fetch inventory data when switching to inventory view
  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const res = await fetch("/api/events/inventory");
      const data = await res.json();
      if (data.success) setInventoryEvents(data.data);
    } catch (e) {
      console.error("Failed to load inventory", e);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "inventory" && inventoryEvents.length === 0) fetchInventory();
  }, [view, inventoryEvents.length, fetchInventory]);

  // Derive category set
  const uniqueItems = useMemo(() => {
    // Global de-duplication for both grid and list (by name + start + end)
    const map = new Map<string, EventItem>();
    for (const ev of items) {
      const k = `${ev.name}|${ev.startDate}|${ev.endDate}`;
      if (!map.has(k)) map.set(k, ev);
    }
    return Array.from(map.values());
  }, [items]);

  // Removed unused categories computation

  // Category colors (static classes so Tailwind includes them)
  const CAT_COLORS: Record<string, { start: string; cont: string }> = {
    "formula-1": { start: "bg-red-500/80 text-white", cont: "bg-red-500/35" },
    rugby: { start: "bg-violet-500/80 text-white", cont: "bg-violet-500/35" },
    theatre: { start: "bg-pink-500/80 text-white", cont: "bg-pink-500/35" },
    concerts: { start: "bg-indigo-500/80 text-white", cont: "bg-indigo-500/35" },
    "horse-racing": { start: "bg-lime-500/80 text-black", cont: "bg-lime-500/35" },
    golf: { start: "bg-teal-500/80 text-white", cont: "bg-teal-500/35" },
    dining: { start: "bg-rose-500/80 text-white", cont: "bg-rose-500/35" },
    experiences: { start: "bg-sky-500/80 text-white", cont: "bg-sky-500/35" },
    tennis: { start: "bg-green-500/80 text-white", cont: "bg-green-500/35" },
    festival: { start: "bg-fuchsia-500/80 text-white", cont: "bg-fuchsia-500/35" },
    fashion: { start: "bg-cyan-500/80 text-black", cont: "bg-cyan-500/35" },
    music: { start: "bg-purple-500/80 text-white", cont: "bg-purple-500/35" },
    "rowing-sailing": { start: "bg-blue-500/80 text-white", cont: "bg-blue-500/35" },
    football: { start: "bg-emerald-500/80 text-white", cont: "bg-emerald-500/35" },
  };

  function colorFor(category: string) {
    return CAT_COLORS[category] || { start: "bg-muted/80 text-foreground", cont: "bg-muted/40" };
  }

  // Hover lightbox
  const [hovered, setHovered] = useState<EventItem | null>(null);
  const [hoverDetails, setHoverDetails] = useState<Record<string, Partial<EventItem>>>({});

  // Fetch missing details (like imageUrl) on hover
  useEffect(() => {
    const fetchDetails = async () => {
      if (!hovered) return;
      if (hovered.imageUrl || hoverDetails[hovered.id]?.imageUrl) return;
      try {
        const res = await fetch(`/api/events/${hovered.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setHoverDetails((prev) => ({ ...prev, [hovered.id]: data }));
      } catch {}
    };
    fetchDetails();
  }, [hovered, hoverDetails]);

  // Month helpers
  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  function formatMonthLabel(yyyyMM: string) {
    const [y, m] = yyyyMM.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  }

  // Build calendar grid days for the month
  const daysGrid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startWeekday = (first.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(Date.UTC(y, m - 1, d)) });
    while (cells.length % 7 !== 0) cells.push({ date: null });
    const weeks: { date: Date | null }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [month]);

  // Removed unused eventsByDay computation

  return (
    <DashboardLayout>
      <div className="h-dvh overflow-y-auto bg-gradient-to-br from-background to-muted/20 p-6 pl-24 lg:p-8 lg:pl-24">
        <div className="max-w-7xl mx-auto pb-24 border border-border/50 rounded-2xl p-4">
          <div className="mb-6">
            <div className="grid grid-cols-3 items-center gap-3">
              {/* Left: Search */}
              <div className="justify-self-start">
                <Input
                  placeholder="Search events..."
                  className="w-56 md:w-64"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {/* Center: Title + Month Controls */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="justify-self-center flex flex-col items-center gap-2"
              >
                <h1 className="text-2xl md:text-3xl font-bold whitespace-nowrap pb-4">Upcoming Events</h1>
                <div className="flex items-center gap-2">
                  <Button className="px-2 py-1" variant="outline" onClick={() => shiftMonth(-1)} aria-label="Previous month">&larr;</Button>
                  <div className="font-semibold w-32 md:w-44 text-center whitespace-nowrap">{formatMonthLabel(month)}</div>
                  <Button className="px-2 py-1" variant="outline" onClick={() => shiftMonth(1)} aria-label="Next month">&rarr;</Button>
                </div>
              </motion.div>
              {/* Right: View toggle */}
              <div className="justify-self-end flex items-center gap-2">
                <Button variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")}>Grid</Button>
                <Button variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>List</Button>
                <Button variant={view === "inventory" ? "default" : "outline"} onClick={() => setView("inventory")}>Inventory</Button>
              </div>
            </div>
          </div>

          {view === "inventory" ? (
            <InventoryView
              events={inventoryEvents}
              loading={inventoryLoading}
            />
          ) : loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">No events yet.</p>
          ) : view === "list" ? (
            <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
              {uniqueItems.map((e, idx) => {
                const isPast = new Date(e.endDate).toISOString().slice(0,10) < todayStr
                return (
                <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.01 }}>
                  <Card className={`relative overflow-hidden hover:shadow-md transition h-full ${isPast ? 'opacity-90' : ''}`}>
                    {/* Image (16:9) */}
                    <div className="relative w-full aspect-video bg-muted">
                      {e.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(e.imageUrl)}`}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-background/80 border">
                        {e.category}
                      </div>
                    </div>
                    {/* Text */}
                    <CardContent className="p-4">
                      <div className="font-semibold text-base md:text-lg">{e.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(e.startDate).toLocaleDateString()} – {new Date(e.endDate).toLocaleDateString()} • {e.location}
                      </div>
                      <div className="text-sm mt-3 line-clamp-4">{e.description}</div>
                    </CardContent>
                    {isPast && (
                      <div className="pointer-events-none absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-sm font-semibold tracking-wide uppercase">Event Passed</span>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )})}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                <div key={d} className="text-xs font-medium text-muted-foreground text-center py-2">{d}</div>
              ))}
              {daysGrid.map((week, wi) => {
                const weekDates = week.map((c) => c.date).filter(Boolean) as Date[]
                const weekStart = weekDates[0]
                const weekEnd = weekDates[weekDates.length - 1]

                // Build spanning bars for this week (overlay layer)
                const bars: { e: EventItem; startCol: number; endCol: number; level: number; startsInWeek: boolean; endsInWeek: boolean }[] = []
                const levels: { endCol: number }[] = []
                for (const e of uniqueItems) {
                  const s = new Date(e.startDate)
                  const en = new Date(e.endDate)
                  if (!weekStart || !weekEnd) continue
                  if (en < weekStart || s > weekEnd) continue
                  // compute start/end columns relative to this week
                  let startCol = week.findIndex((c) => c.date && c.date >= s)
                  if (startCol === -1) startCol = week.findIndex((c) => c.date !== null)
                  const endColRev = [...week].reverse().findIndex((c) => c.date && c.date <= en)
                  const endCol = endColRev === -1 ? week.length - 1 : week.length - 1 - endColRev
                  const startsInWeek = s >= weekStart
                  const endsInWeek = en <= weekEnd
                  // simple stacking to avoid overlaps in same row
                  let level = 0
                  while (level < levels.length && levels[level].endCol >= startCol) level++
                  if (level === levels.length) levels.push({ endCol })
                  levels[level].endCol = Math.max(levels[level].endCol, endCol)
                  bars.push({ e, startCol, endCol, level, startsInWeek, endsInWeek })
                }

                return (
                  <div key={wi} className="relative col-span-7">
                    {/* cells */}
                    <div className="grid grid-cols-7 gap-2">
                      {week.map((cell, di) => {
                        const dayKey = cell.date ? cell.date.toISOString().slice(0,10) : `empty-${wi}-${di}`
                        const isToday = cell.date ? cell.date.toISOString().slice(0,10) === todayStr : false
                        return (
                          <div
                            key={dayKey}
                            className={`min-h-24 rounded-lg border p-2 ${
                              isToday
                                ? 'bg-primary/10 text-foreground border-primary/30'
                                : 'bg-card/60'
                            }`}
                          >
                            <div className={`text-xs font-semibold ${isToday ? '' : 'opacity-70'}`}>
                              {cell.date ? (isToday ? 'Today' : cell.date.getUTCDate()) : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* overlay spanning bars (bridge across cells) */}
                    <div className="absolute inset-0 grid grid-cols-7 gap-2 p-2 pointer-events-none">
                      {bars.map((b, idx) => {
                        const colors = colorFor(b.e.category)
                        const radius = b.startsInWeek && b.endsInWeek ? 'rounded-md' : b.startsInWeek ? 'rounded-l-md' : b.endsInWeek ? 'rounded-r-md' : 'rounded-none'
                        const isPast = new Date(b.e.endDate).toISOString().slice(0,10) < todayStr
                        return (
                          <div
                            key={`${b.e.id}-${idx}`}
                            className="flex items-center"
                            style={{ gridColumn: `${b.startCol + 1} / ${b.endCol + 2}`, marginTop: `${b.level * 12}px` }}
                          >
                            <div className={`h-6 w-full ${isPast ? 'bg-gray-500/60 text-white' : colors.start} ${radius} px-2 flex items-center overflow-hidden pointer-events-auto`}
                              onMouseEnter={() => setHovered(b.e)}
                              onMouseLeave={() => setHovered(null)}
                            >
                              {b.startsInWeek && (
                                <span className="text-xs font-medium truncate">{b.e.name}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Hover lightbox (soft fade, no click required) */}
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center pointer-events-none"
              onMouseEnter={() => setHovered(hovered)}
              onMouseLeave={() => setHovered(null)}
            >
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-auto w-full max-w-xl mx-4 bg-card rounded-xl border overflow-hidden shadow-xl"
              >
                {(() => { const d: EventItem = { ...hovered, ...(hoverDetails[hovered.id] || {}) } as EventItem; return (
                <>
                <div className="relative w-full aspect-video bg-muted">
                  {(d.imageUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/image-proxy?url=${encodeURIComponent(String(d.imageUrl))}`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-background/80 border">
                    {d.category}
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-lg font-semibold">{d.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {new Date(d.startDate).toLocaleDateString()} – {new Date(d.endDate).toLocaleDateString()} {d.location ? `• ${d.location}` : ''}
                  </div>
                  {d.description && (
                    <div className="text-sm mt-3">{d.description}</div>
                  )}
                </div>
                </>
                ) })()}
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}


