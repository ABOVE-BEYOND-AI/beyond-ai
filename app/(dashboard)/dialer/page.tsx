"use client";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneOutgoing,
  MagnifyingGlass,
  Funnel,
  CaretLeft,
  CaretRight,
  X,
  SpinnerGap,
  Play,
  SkipForward,
  SkipBack,
  Trash,
  CheckCircle,
  XCircle,
  Voicemail,
  PhoneSlash,
  ArrowClockwise,
  Warning,
  UserCircle,
  Buildings,
  CurrencyGbp,
  Note,
  Tag,
  ListBullets,
  Lightning,
} from "@phosphor-icons/react";
import type { DialerListItem } from "@/lib/salesforce-types";
import { formatRelativeTime } from "@/lib/constants";

// ── Types ──

type DialerMode = "list-builder" | "active-dialing";
type SourceType = "leads" | "contacts";

interface Filters {
  source: SourceType;
  eventInterest: string;
  status: string;
  minSpend: string;
  maxSpend: string;
  noteKeyword: string;
  owner: string;
}

interface DispositionOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  tagName: string;
}

const DISPOSITION_OPTIONS: DispositionOption[] = [
  {
    key: "interested",
    label: "Interested",
    icon: <CheckCircle weight="fill" className="w-5 h-5" />,
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30",
    tagName: "interested",
  },
  {
    key: "not_interested",
    label: "Not Interested",
    icon: <XCircle weight="fill" className="w-5 h-5" />,
    color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30",
    tagName: "not-interested",
  },
  {
    key: "no_answer",
    label: "No Answer",
    icon: <PhoneSlash weight="fill" className="w-5 h-5" />,
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30",
    tagName: "no-answer",
  },
  {
    key: "voicemail",
    label: "Voicemail",
    icon: <Voicemail weight="fill" className="w-5 h-5" />,
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30",
    tagName: "voicemail",
  },
  {
    key: "callback",
    label: "Call Back",
    icon: <ArrowClockwise weight="fill" className="w-5 h-5" />,
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30",
    tagName: "callback",
  },
  {
    key: "wrong_number",
    label: "Wrong Number",
    icon: <Warning weight="fill" className="w-5 h-5" />,
    color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/30",
    tagName: "wrong-number",
  },
];

const LEAD_STATUSES = [
  "New",
  "Working",
  "Nurturing",
  "Qualified",
  "Unqualified",
];

// ── Page ──

export default function DialerPage() {
  const { user, loading: authLoading } = useGoogleAuth();
  const router = useRouter();

  // ── State ──
  const [mode, setMode] = useState<DialerMode>("list-builder");
  const [filters, setFilters] = useState<Filters>({
    source: "leads",
    eventInterest: "",
    status: "",
    minSpend: "",
    maxSpend: "",
    noteKeyword: "",
    owner: "",
  });
  const [queue, setQueue] = useState<DialerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active dialing state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [callInProgress, setCallInProgress] = useState(false);
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  const [dispositionSaving, setDispositionSaving] = useState(false);
  const [quickNotes, setQuickNotes] = useState("");
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [removedSet, setRemovedSet] = useState<Set<string>>(new Set());

  const notesRef = useRef<HTMLTextAreaElement>(null);

  // ── Auth guard ──
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // ── Build list ──
  const buildList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("source", filters.source);
      if (filters.eventInterest) params.set("eventInterest", filters.eventInterest);
      if (filters.status) params.set("status", filters.status);
      if (filters.owner) params.set("owner", filters.owner);
      if (filters.minSpend) params.set("minSpend", filters.minSpend);
      if (filters.maxSpend) params.set("maxSpend", filters.maxSpend);
      if (filters.noteKeyword) params.set("noteKeyword", filters.noteKeyword);

      const res = await fetch(`/api/dialer/lists?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setQueue(data.data);
      setCompletedSet(new Set());
      setRemovedSet(new Set());
      setCurrentIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ── Active queue (excludes removed) ──
  const activeQueue = queue.filter((item) => !removedSet.has(item.id));
  const currentItem = activeQueue[currentIndex] || null;
  const totalActive = activeQueue.length;
  const completedCount = completedSet.size;

  // ── Start call ──
  const startCall = async () => {
    if (!currentItem) return;
    const phoneNumber = currentItem.mobilePhone || currentItem.phone;
    if (!phoneNumber) return;

    setCallInProgress(true);
    setActiveCallId(null);
    try {
      const res = await fetch("/api/dialer/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 0, phoneNumber }),
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        setActiveCallId(data.data.id);
      }
    } catch {
      // Call initiation is best-effort; the rep can still log outcome
    }
  };

  // ── Log disposition ──
  const logDisposition = async (disposition: DispositionOption) => {
    if (!currentItem) return;
    setDispositionSaving(true);
    try {
      await fetch("/api/dialer/disposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: activeCallId,
          objectType: currentItem.type === "lead" ? "Lead" : "Contact",
          recordId: currentItem.id,
          disposition: disposition.label,
          notes: quickNotes || undefined,
          tagName: disposition.tagName,
        }),
      });
      setCompletedSet((prev) => new Set([...prev, currentItem.id]));
      setCallInProgress(false);
      setActiveCallId(null);
      setQuickNotes("");
      // Auto-advance
      if (currentIndex < totalActive - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch {
      // Disposition save failed silently; user can retry
    } finally {
      setDispositionSaving(false);
    }
  };

  // ── Navigation ──
  const goNext = () => {
    if (currentIndex < totalActive - 1) {
      setCurrentIndex((prev) => prev + 1);
      setCallInProgress(false);
      setActiveCallId(null);
      setQuickNotes("");
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setCallInProgress(false);
      setActiveCallId(null);
      setQuickNotes("");
    }
  };

  const removeFromQueue = () => {
    if (!currentItem) return;
    setRemovedSet((prev) => new Set([...prev, currentItem.id]));
    setCallInProgress(false);
    setActiveCallId(null);
    setQuickNotes("");
    // If we removed the last item, go back one
    if (currentIndex >= totalActive - 1 && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const startDialing = () => {
    setMode("active-dialing");
    setCurrentIndex(0);
    setCallInProgress(false);
    setActiveCallId(null);
    setQuickNotes("");
    setCompletedSet(new Set());
    setRemovedSet(new Set());
  };

  // ── Auth loading ──
  if (authLoading || !user) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <SpinnerGap className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-dvh bg-gradient-to-br from-background to-muted/20 p-6 pl-24 lg:p-8 lg:pl-24">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <PhoneOutgoing className="w-5 h-5 text-primary" weight="duotone" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Auto-Dialer
              </h1>
              <p className="text-sm text-muted-foreground">
                Build calling lists and power through outbound cadences
              </p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("list-builder")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === "list-builder"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListBullets className="w-4 h-4 inline-block mr-1.5" weight="bold" />
              List Builder
            </button>
            <button
              onClick={() => queue.length > 0 && setMode("active-dialing")}
              disabled={queue.length === 0}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === "active-dialing"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-card border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              <Lightning className="w-4 h-4 inline-block mr-1.5" weight="fill" />
              Active Dialing
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === "list-builder" ? (
            <motion.div
              key="list-builder"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* ── Filter Panel ── */}
              <div className="rounded-2xl bg-card border border-border/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Funnel className="w-5 h-5 text-muted-foreground" weight="duotone" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Filter Criteria
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Source toggle */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Source
                    </label>
                    <div className="flex rounded-xl overflow-hidden border border-border/50">
                      <button
                        onClick={() =>
                          setFilters((f) => ({ ...f, source: "leads" }))
                        }
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-all ${
                          filters.source === "leads"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Leads
                      </button>
                      <button
                        onClick={() =>
                          setFilters((f) => ({ ...f, source: "contacts" }))
                        }
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-all ${
                          filters.source === "contacts"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Contacts
                      </button>
                    </div>
                  </div>

                  {/* Event Interest */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Event Interest
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Formula 1, Wimbledon"
                      value={filters.eventInterest}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          eventInterest: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Status (leads only) */}
                  {filters.source === "leads" && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Status
                      </label>
                      <select
                        value={filters.status}
                        onChange={(e) =>
                          setFilters((f) => ({ ...f, status: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">All Statuses</option>
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Spend range (contacts) */}
                  {filters.source === "contacts" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Min Spend
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={filters.minSpend}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              minSpend: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Max Spend
                        </label>
                        <input
                          type="number"
                          placeholder="No limit"
                          value={filters.maxSpend}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              maxSpend: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </>
                  )}

                  {/* Notes keyword */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Notes Keyword
                    </label>
                    <div className="relative">
                      <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search in recent notes"
                        value={filters.noteKeyword}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            noteKeyword: e.target.value,
                          }))
                        }
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Owner */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Owner ID
                    </label>
                    <input
                      type="text"
                      placeholder="Salesforce Owner ID"
                      value={filters.owner}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, owner: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border/30">
                  <button
                    onClick={buildList}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <SpinnerGap className="w-4 h-4 animate-spin" />
                    ) : (
                      <ListBullets className="w-4 h-4" weight="bold" />
                    )}
                    Build List
                  </button>

                  {queue.length > 0 && (
                    <button
                      onClick={startDialing}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-500 transition-all flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" weight="fill" />
                      Start Calling ({queue.length})
                    </button>
                  )}

                  {queue.length > 0 && (
                    <span className="text-sm text-muted-foreground ml-auto">
                      {queue.length} record{queue.length !== 1 ? "s" : ""} in
                      queue
                    </span>
                  )}
                </div>
              </div>

              {/* ── Error ── */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3"
                >
                  <Warning className="w-5 h-5 text-red-400" weight="fill" />
                  <span className="text-sm text-red-400">{error}</span>
                </motion.div>
              )}

              {/* ── Results Grid ── */}
              {queue.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-card border border-border/50 overflow-hidden"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Name
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Company
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Type
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Spend
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Last Note
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Owner
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map((item, idx) => (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.02 }}
                            className="border-b border-border/20 hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <UserCircle
                                  className="w-5 h-5 text-muted-foreground flex-shrink-0"
                                  weight="duotone"
                                />
                                <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                                {item.company || "--"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-foreground font-mono">
                                {item.mobilePhone || item.phone || "--"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.type === "lead"
                                    ? "bg-blue-500/15 text-blue-400"
                                    : "bg-emerald-500/15 text-emerald-400"
                                }`}
                              >
                                {item.type === "lead" ? "Lead" : "Contact"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-foreground">
                                {item.totalSpend != null
                                  ? `£${item.totalSpend.toLocaleString()}`
                                  : "--"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                                {item.recentNote
                                  ? item.recentNote.substring(0, 60) +
                                    (item.recentNote.length > 60 ? "..." : "")
                                  : "--"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-muted-foreground">
                                {item.owner || "--"}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* ── Empty state ── */}
              {!loading && queue.length === 0 && !error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl bg-card border border-border/50 p-16 text-center"
                >
                  <Phone
                    className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4"
                    weight="duotone"
                  />
                  <p className="text-lg font-medium text-muted-foreground mb-1">
                    No calling list yet
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    Set your filters and click &quot;Build List&quot; to create
                    a calling queue
                  </p>
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* ── Active Dialing Mode ── */
            <motion.div
              key="active-dialing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Progress bar */}
              <div className="rounded-2xl bg-card border border-border/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Call {Math.min(currentIndex + 1, totalActive)} of{" "}
                    {totalActive}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {completedCount} completed
                    {removedSet.size > 0 &&
                      ` / ${removedSet.size} skipped`}
                  </span>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        totalActive > 0
                          ? ((currentIndex + 1) / totalActive) * 100
                          : 0
                      }%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {currentItem ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* ── Contact Card ── */}
                  <div className="lg:col-span-2 space-y-6">
                    <motion.div
                      key={currentItem.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl bg-card border border-border/50 p-6"
                    >
                      {/* Name + type badge */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <UserCircle
                              className="w-8 h-8 text-primary"
                              weight="duotone"
                            />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-foreground">
                              {currentItem.name}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                              {currentItem.company && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Buildings className="w-3.5 h-3.5" />
                                  {currentItem.company}
                                </span>
                              )}
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                  currentItem.type === "lead"
                                    ? "bg-blue-500/15 text-blue-400"
                                    : "bg-emerald-500/15 text-emerald-400"
                                }`}
                              >
                                {currentItem.type === "lead"
                                  ? "Lead"
                                  : "Contact"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {completedSet.has(currentItem.id) && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                            <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                            Dispositioned
                          </span>
                        )}
                      </div>

                      {/* Phone number - prominent */}
                      <div className="rounded-xl bg-muted/30 border border-border/30 p-5 mb-6">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Phone Number
                        </div>
                        <div className="text-2xl font-bold text-foreground font-mono tracking-wide">
                          {currentItem.mobilePhone || currentItem.phone || "No phone"}
                        </div>
                        {currentItem.mobilePhone && currentItem.phone && currentItem.mobilePhone !== currentItem.phone && (
                          <div className="text-sm text-muted-foreground mt-1 font-mono">
                            Alt: {currentItem.phone}
                          </div>
                        )}
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {currentItem.totalSpend != null && (
                          <div className="rounded-xl bg-muted/20 p-3">
                            <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                              <CurrencyGbp className="w-3 h-3" />
                              Total Spend
                            </div>
                            <div className="text-sm font-semibold text-foreground">
                              £{currentItem.totalSpend.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {currentItem.eventInterest && (
                          <div className="rounded-xl bg-muted/20 p-3">
                            <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              Event Interest
                            </div>
                            <div className="text-sm font-semibold text-foreground truncate">
                              {currentItem.eventInterest}
                            </div>
                          </div>
                        )}
                        {currentItem.lastActivity && (
                          <div className="rounded-xl bg-muted/20 p-3">
                            <div className="text-xs text-muted-foreground mb-0.5">
                              Last Activity
                            </div>
                            <div className="text-sm font-semibold text-foreground">
                              {formatRelativeTime(currentItem.lastActivity)}
                            </div>
                          </div>
                        )}
                        {currentItem.owner && (
                          <div className="rounded-xl bg-muted/20 p-3">
                            <div className="text-xs text-muted-foreground mb-0.5">
                              Owner
                            </div>
                            <div className="text-sm font-semibold text-foreground">
                              {currentItem.owner}
                            </div>
                          </div>
                        )}
                        {currentItem.email && (
                          <div className="rounded-xl bg-muted/20 p-3 col-span-2">
                            <div className="text-xs text-muted-foreground mb-0.5">
                              Email
                            </div>
                            <div className="text-sm font-semibold text-foreground truncate">
                              {currentItem.email}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Recent note */}
                      {currentItem.recentNote && (
                        <div className="mt-4 rounded-xl bg-muted/20 border border-border/20 p-4">
                          <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                            <Note className="w-3 h-3" />
                            Recent Note
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">
                            {currentItem.recentNote}
                          </p>
                        </div>
                      )}
                    </motion.div>

                    {/* ── Call + Disposition ── */}
                    <div className="rounded-2xl bg-card border border-border/50 p-6">
                      {/* Call button */}
                      <div className="flex items-center justify-center mb-6">
                        <button
                          onClick={startCall}
                          disabled={
                            callInProgress ||
                            !(currentItem.mobilePhone || currentItem.phone)
                          }
                          className={`px-8 py-4 rounded-2xl font-semibold text-base transition-all flex items-center gap-3 ${
                            callInProgress
                              ? "bg-emerald-600/20 text-emerald-400 border-2 border-emerald-500/40 animate-pulse"
                              : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                          }`}
                        >
                          {callInProgress ? (
                            <>
                              <Phone className="w-6 h-6 animate-bounce" weight="fill" />
                              Call In Progress...
                            </>
                          ) : (
                            <>
                              <Phone className="w-6 h-6" weight="fill" />
                              Call{" "}
                              {currentItem.mobilePhone || currentItem.phone || "N/A"}
                            </>
                          )}
                        </button>
                      </div>

                      {/* Disposition row */}
                      <div className="mb-4">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                          Call Outcome
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                          {DISPOSITION_OPTIONS.map((d) => (
                            <button
                              key={d.key}
                              onClick={() => logDisposition(d)}
                              disabled={dispositionSaving}
                              className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${d.color} disabled:opacity-50`}
                            >
                              {dispositionSaving ? (
                                <SpinnerGap className="w-5 h-5 animate-spin" />
                              ) : (
                                d.icon
                              )}
                              <span className="text-xs">{d.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quick notes */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Quick Notes
                        </label>
                        <textarea
                          ref={notesRef}
                          value={quickNotes}
                          onChange={(e) => setQuickNotes(e.target.value)}
                          placeholder="Add notes about the call..."
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Sidebar: Queue Navigation ── */}
                  <div className="space-y-4">
                    {/* Navigation controls */}
                    <div className="rounded-2xl bg-card border border-border/50 p-4">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Navigation
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={goPrev}
                          disabled={currentIndex === 0}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/30 text-sm font-medium text-foreground hover:bg-muted/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <SkipBack className="w-4 h-4" weight="fill" />
                          Prev
                        </button>
                        <button
                          onClick={goNext}
                          disabled={currentIndex >= totalActive - 1}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/30 text-sm font-medium text-foreground hover:bg-muted/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Next
                          <SkipForward className="w-4 h-4" weight="fill" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={removeFromQueue}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          Remove
                        </button>
                        <button
                          onClick={goNext}
                          disabled={currentIndex >= totalActive - 1}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <CaretRight className="w-3.5 h-3.5" weight="bold" />
                          Skip
                        </button>
                      </div>
                    </div>

                    {/* Queue list */}
                    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                      <div className="p-4 border-b border-border/30">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Queue ({totalActive} remaining)
                        </div>
                      </div>
                      <div className="max-h-[450px] overflow-y-auto">
                        {activeQueue.map((item, idx) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setCurrentIndex(idx);
                              setCallInProgress(false);
                              setActiveCallId(null);
                              setQuickNotes("");
                            }}
                            className={`w-full text-left px-4 py-3 border-b border-border/10 transition-all hover:bg-muted/30 ${
                              idx === currentIndex
                                ? "bg-primary/5 border-l-2 border-l-primary"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">
                                  {item.name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.company || item.email || "--"}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                {completedSet.has(item.id) && (
                                  <CheckCircle
                                    className="w-4 h-4 text-emerald-400"
                                    weight="fill"
                                  />
                                )}
                                <span className="text-xs text-muted-foreground/60">
                                  {idx + 1}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Back to list builder */}
                    <button
                      onClick={() => setMode("list-builder")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-muted/30 border border-border/30 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                    >
                      <CaretLeft className="w-4 h-4" />
                      Back to List Builder
                    </button>
                  </div>
                </div>
              ) : (
                /* Empty queue in active mode */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl bg-card border border-border/50 p-16 text-center"
                >
                  <CheckCircle
                    className="w-12 h-12 text-emerald-400/50 mx-auto mb-4"
                    weight="duotone"
                  />
                  <p className="text-lg font-medium text-foreground mb-1">
                    Queue Complete
                  </p>
                  <p className="text-sm text-muted-foreground/70 mb-4">
                    You have called through all records in this list.
                  </p>
                  <button
                    onClick={() => setMode("list-builder")}
                    className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all"
                  >
                    Build New List
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
