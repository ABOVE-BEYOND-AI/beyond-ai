"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export default function EventsPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const selectedCategory = "all" as const;
  const [view, setView] = useState<"grid" | "list">("grid");
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
      } catch (_e) {
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of uniqueItems) set.add(e.category);
    return ["all", ...Array.from(set).sort()];
  }, [uniqueItems]);

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
  }, [hovered]);

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

  // Map events to each day (inclusive range)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of uniqueItems) {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      for (
        let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
        d <= end;
        d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
      ) {
        const key = d.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
    }
    return map;
  }, [uniqueItems]);

  return (
    <DashboardLayout>
      <div className="h-screen overflow-y-auto bg-gradient-to-br from-background to-muted/20 p-6 lg:p-8 pl-24">
        <div className="max-w-7xl mx-auto pb-24 border border-white/10 rounded-2xl p-4">
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
              </div>
            </div>
          </div>

          {loading ? (
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
                                ? 'bg-gray-100 text-black dark:bg-white/15 dark:text-foreground border-white'
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
                {(() => { const d = (hoverDetails[hovered.id] as any) || hovered; return (
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


