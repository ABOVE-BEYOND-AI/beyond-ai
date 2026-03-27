"use client";

import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Users,
  TrendUp,
  ArrowsClockwise,
  Brain,
  Lightning,
  Warning,
  Target,
  Trophy,
  ChatText,
  CaretRight,
  MagicWand,
  X,
  SpinnerGap,
  Pulse,
  ArrowsOut,
  MagnifyingGlass,
  CalendarBlank,
  Funnel,
  FileText,
  Briefcase,
  CalendarCheck,
  UserPlus,
  Confetti,
  Copy,
  CheckCircle,
  Clock,
  CaretDown,
  CaretUp,
  Eye,
  Timer,
  Gauge,
} from "@phosphor-icons/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLightbulb, faTrophy } from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import NumberFlow from "@number-flow/react";

// ── Types ──

type Tab = "overview" | "intelligence" | "digest" | "transcripts" | "dial-pace";
type CallPeriod = "today" | "week" | "month";
type FullscreenView = null | "reps" | "calls";

interface CallStats {
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_duration: number;
  avg_duration: number;
  total_talk_time: number;
  avg_talk_time: number;
}

interface RepCallStats {
  name: string;
  email: string;
  user_id: number;
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  total_duration: number;
  avg_duration: number;
  longest_call: number;
  answered_calls: number;
}

interface RecentCall {
  id: number;
  direction: string;
  duration: number;
  started_at: number;
  status: string;
  agent_name: string;
  contact_name: string;
  has_recording: boolean;
}

interface HourlyData {
  [hour: number]: { inbound: number; outbound: number };
}

interface CallDataResponse {
  period: CallPeriod;
  stats: CallStats;
  repStats: RepCallStats[];
  recentCalls: RecentCall[];
  analysableCalls: RecentCall[];
  meaningfulCallCount: number;
  hourlyDistribution: HourlyData;
}

interface CallAnalysis {
  call_id: number;
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  sentiment_score: number;
  key_topics: string[];
  objections: string[];
  action_items: {
    description: string;
    assignee: string;
    priority: "high" | "medium" | "low";
  }[];
  opportunity_signals: {
    type: string;
    description: string;
    estimated_value?: string;
  }[];
  competitor_mentions: string[];
  events_mentioned: (string | { event: string; context: string })[];
  talk_to_listen_ratio: { agent_pct: number; contact_pct: number };
  coaching_notes: string | null;
  draft_follow_up: string | null;
  analysed_at: string;
}

interface TranscriptSearchResult {
  callId: number;
  agentName: string;
  contactName: string;
  duration: number;
  direction: "inbound" | "outbound";
  startedAt: number;
  excerpt: string;
  matchCount: number;
}

interface EventRecapData {
  date: string;
  dealsClosedToday: { name: string; amount: number; owner: string; event: string; accountName: string; guests: number | null }[];
  totalDealValue: number;
  leadsCreatedToday: number;
  upcomingEvents: { name: string; startDate: string; category: string | null; revenueTarget: number | null; closedWonGross: number | null; percentageToTarget: number | null }[];
  callStats: { total: number; inbound: number; outbound: number; answered: number; missed: number; totalDuration: number; avgDuration: number } | null;
  generatedAt: string;
}

interface DailyDigest {
  period: string;
  generated_at: string;
  total_calls_analysed: number;
  team_summary: string;
  top_objections: {
    objection: string;
    frequency: number;
    suggested_response: string;
  }[];
  winning_pitches: {
    description: string;
    rep: string;
    context: string;
  }[];
  event_demand: {
    event: string;
    mentions: number;
    sentiment: string;
  }[];
  competitor_intelligence: {
    competitor: string;
    mentions: number;
    context: string;
  }[];
  follow_up_gaps: {
    rep: string;
    description: string;
  }[];
  coaching_highlights: {
    rep: string;
    type: "strength" | "improvement";
    description: string;
  }[];
  key_deals: {
    contact: string;
    rep: string;
    status: string;
    next_steps: string;
  }[];
}

// ── Config ──

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Pulse },
  { key: "intelligence", label: "Call Intelligence", icon: Brain },
  { key: "digest", label: "AI Digest", icon: MagicWand },
  { key: "transcripts", label: "Transcript Search", icon: MagnifyingGlass },
  { key: "dial-pace", label: "Dial Pace", icon: Timer },
];

const PERIODS: { key: CallPeriod; label: string; shortLabel: string }[] = [
  { key: "today", label: "Today", shortLabel: "today" },
  { key: "week", label: "This Week", shortLabel: "this week" },
  { key: "month", label: "This Month", shortLabel: "this month" },
];

const POLL_INTERVAL_MS = 180_000; // 3 minutes — Aircall rate limit is 60 req/min

// ── Helpers ──

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function formatTime(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(unixTimestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixTimestamp;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function periodLabel(period: CallPeriod): string {
  return PERIODS.find((p) => p.key === period)?.shortLabel || "today";
}

function formatGapShort(seconds: number): string {
  if (!seconds || seconds === 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function gapColorClass(seconds: number): string {
  if (seconds <= 120) return "text-emerald-500";
  if (seconds <= 300) return "text-amber-500";
  return "text-red-500";
}

function gapBgClass(seconds: number): string {
  if (seconds <= 120) return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
  if (seconds <= 300) return "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400";
  return "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400";
}

// ── Highlight keyword in excerpt ──

function highlightExcerpt(excerpt: string, keyword: string): React.ReactNode {
  if (!keyword) return excerpt;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = excerpt.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="bg-primary/25 text-primary font-semibold rounded-sm px-0.5">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// ── Activity Bar Chart (full-width, taller, colored) ──

function ActivityChart({ data }: { data: HourlyData }) {
  const hours = Object.keys(data)
    .map(Number)
    .sort((a, b) => a - b);
  const maxVal = Math.max(
    ...hours.map((h) => (data[h]?.inbound || 0) + (data[h]?.outbound || 0)),
    1
  );

  return (
    <div className="flex items-end gap-1 h-44 px-1">
      {hours.map((hour) => {
        const inbound = data[hour]?.inbound || 0;
        const outbound = data[hour]?.outbound || 0;
        const total = inbound + outbound;
        const barH = 160;

        return (
          <div key={hour} className="flex-1 flex flex-col items-center gap-1.5 group relative">
            <div className="w-full flex flex-col items-stretch">
              {/* Outbound: blue */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(outbound / maxVal) * barH}px` }}
                transition={{ duration: 0.6, delay: hour * 0.025, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="bg-blue-500/60 dark:bg-blue-400/50 rounded-t-sm min-h-0"
                style={{ minHeight: outbound > 0 ? 2 : 0 }}
              />
              {/* Inbound: violet */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(inbound / maxVal) * barH}px` }}
                transition={{ duration: 0.6, delay: hour * 0.025 + 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="bg-violet-500/40 dark:bg-violet-400/35 rounded-b-sm min-h-0"
                style={{ minHeight: inbound > 0 ? 2 : 0 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground/40 tabular-nums font-medium">
              {hour.toString().padStart(2, "0")}
            </span>
            {total > 0 && (
              <div className="absolute bottom-full mb-2 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                <span className="font-semibold">{total}</span>
                <span className="text-muted-foreground ml-1">({outbound} out · {inbound} in)</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Rep Row ──

function RepRow({
  rep,
  index,
  maxCalls,
  large = false,
}: {
  rep: RepCallStats;
  index: number;
  maxCalls: number;
  large?: boolean;
}) {
  const barWidth = maxCalls > 0 ? (rep.total_calls / maxCalls) * 100 : 0;
  const rankSize = large ? "size-12 text-lg" : "size-8 text-sm";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-4 ${large ? "p-5" : "p-3"} rounded-xl transition-colors hover:bg-foreground/[0.03]`}
    >
      <div
        className={`${rankSize} rounded-full flex items-center justify-center font-bold shrink-0 ${
          index === 0
            ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-lg shadow-yellow-500/20"
            : index === 1
              ? "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700 shadow-lg shadow-gray-400/20"
              : index === 2
                ? "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-lg shadow-amber-600/20"
                : "bg-muted/60 text-muted-foreground"
        }`}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className={`font-semibold truncate ${large ? "text-base" : "text-sm"}`}>{rep.name}</p>
          <span className={`font-bold tabular-nums ${large ? "text-lg" : "text-sm"}`}>{rep.total_calls}</span>
        </div>
        <div className="w-full bg-foreground/[0.06] rounded-full h-1.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.6, delay: index * 0.04 }}
            className="h-full rounded-full bg-foreground/20"
          />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-muted-foreground/60 tabular-nums ${large ? "text-sm" : "text-xs"}`}>
            {rep.outbound_calls} out · {rep.inbound_calls} in
          </span>
          <span className={`text-muted-foreground/40 tabular-nums ${large ? "text-sm" : "text-xs"}`}>
            {formatDurationShort(Math.round(rep.avg_duration))} avg
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Call Feed Row ──

function CallRow({ call, onClick, large = false }: { call: RecentCall; onClick: () => void; large?: boolean }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 ${large ? "p-4" : "p-3"} rounded-xl hover:bg-foreground/[0.04] transition-colors text-left group`}
    >
      <div className={`${large ? "size-11" : "size-9"} rounded-full flex items-center justify-center shrink-0 bg-foreground/[0.05] text-muted-foreground`}>
        {call.direction === "inbound" ? (
          <PhoneIncoming className={large ? "size-5" : "size-4"} />
        ) : (
          <PhoneOutgoing className={large ? "size-5" : "size-4"} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium truncate ${large ? "text-base" : "text-sm"}`}>{call.contact_name}</p>
          {call.has_recording && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0 font-medium">
              AI
            </span>
          )}
        </div>
        <p className={`text-muted-foreground/60 truncate ${large ? "text-sm" : "text-xs"}`}>
          {call.agent_name} · {formatDuration(call.duration)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-muted-foreground/50 ${large ? "text-sm" : "text-xs"}`}>{timeAgo(call.started_at)}</p>
      </div>
    </motion.button>
  );
}

// ── Fullscreen Modal ──

function FullscreenModal({
  view,
  onClose,
  repStats,
  recentCalls,
  maxRepCalls,
  period,
  onCallClick,
}: {
  view: FullscreenView;
  onClose: () => void;
  repStats: RepCallStats[];
  recentCalls: RecentCall[];
  maxRepCalls: number;
  period: CallPeriod;
  onCallClick: (callId: number) => void;
}) {
  if (!view) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-3 rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          aria-label="Close fullscreen"
        >
          <X className="size-6" />
        </button>

        <div className="h-full overflow-y-auto p-8 lg:p-12">
          <div className="flex items-center gap-4 mb-8">
            {view === "reps" ? (
              <FontAwesomeIcon icon={faTrophy} className="h-8 w-8 text-yellow-500" />
            ) : (
              <Phone className="size-8 text-foreground" weight="bold" />
            )}
            <h1 className="text-3xl font-bold tracking-tight">
              {view === "reps" ? "Calls by Rep" : "Recent Calls"}
            </h1>
            <span className="text-xl text-muted-foreground">{periodLabel(period)}</span>
          </div>

          <div className="max-w-4xl space-y-2">
            {view === "reps" ? (
              repStats.map((rep, index) => (
                <RepRow key={rep.user_id} rep={rep} index={index} maxCalls={maxRepCalls} large />
              ))
            ) : (
              recentCalls.map((call) => (
                <CallRow
                  key={call.id}
                  call={call}
                  large
                  onClick={() => {
                    if (call.has_recording) {
                      onClose();
                      onCallClick(call.id);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Call Analysis Panel ──

function AnalysisPanel({
  analysis,
  transcript,
  onClose,
  onTopicClick,
}: {
  analysis: CallAnalysis;
  transcript: string | null;
  onClose: () => void;
  onTopicClick?: (topic: string) => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const sentimentStyles = {
    negative: "bg-red-500/10 text-red-500 border-red-500/20",
    mixed: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    neutral: "bg-foreground/[0.06] text-muted-foreground border-foreground/[0.08]",
  };

  const riskSignals = analysis.opportunity_signals.filter(
    (o) => o.type === "at_risk" || o.type === "closed_lost"
  );

  const agentPct = analysis.talk_to_listen_ratio.agent_pct;
  const ratioNote =
    agentPct < 30
      ? "Client-dominated conversation — active listening mode"
      : agentPct > 70
        ? "Agent-dominated — consider asking more open questions"
        : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-y-0 right-0 w-full max-w-xl z-50 bg-background border-l border-border overflow-y-auto"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Brain className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Call Analysis</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize font-medium ${sentimentStyles[analysis.sentiment]}`}>
              {analysis.sentiment} · {analysis.sentiment_score}/100
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-foreground/10 transition-colors"
            aria-label="Close analysis panel"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Risk Alert Banner */}
        {riskSignals.length > 0 && (
          <div className="mb-6 space-y-2">
            {riskSignals.map((signal, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border flex items-start gap-3 ${
                  signal.type === "closed_lost"
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-amber-500/10 border-amber-500/20"
                }`}
              >
                <Warning
                  weight="fill"
                  className={`size-4 shrink-0 mt-0.5 ${
                    signal.type === "closed_lost" ? "text-red-500" : "text-amber-500"
                  }`}
                />
                <div>
                  <p className={`text-sm font-bold uppercase ${
                    signal.type === "closed_lost" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {signal.type === "closed_lost" ? "LOST" : "AT RISK"}
                    {signal.estimated_value && ` · ${signal.estimated_value}`}
                  </p>
                  <p className="text-sm mt-0.5">{signal.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Summary</h3>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Key Topics */}
        {analysis.key_topics.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Key Topics</h3>
            <div className="flex flex-wrap gap-2">
              {analysis.key_topics.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => onTopicClick?.(topic)}
                  className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                  title="Search transcripts for this topic"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Objections */}
        {analysis.objections.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Warning className="size-3.5 text-muted-foreground" /> Objections Detected
            </h3>
            <div className="space-y-2">
              {analysis.objections.map((obj, i) => (
                <div key={i} className="text-sm p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06]">
                  {obj}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {analysis.action_items.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="size-3.5 text-muted-foreground" /> Action Items
              </h3>
              <button
                onClick={() => {
                  const text = analysis.action_items
                    .map((item) => `☐ [${item.priority.toUpperCase()}] ${item.description} — ${item.assignee}`)
                    .join("\n");
                  copyText(text, "actions");
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {copiedField === "actions" ? <CheckCircle className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copiedField === "actions" ? "Copied" : "Copy all"}
              </button>
            </div>
            <div className="space-y-2">
              {analysis.action_items.map((item, i) => {
                const priorityStyles = {
                  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                  low: "bg-foreground/[0.06] text-muted-foreground border-foreground/[0.08]",
                };
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 text-sm p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06]"
                  >
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 uppercase font-bold ${priorityStyles[item.priority]}`}>
                      {item.priority}
                    </span>
                    <div>
                      <p>{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">→ {item.assignee}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Opportunity Signals (excluding risk signals shown above) */}
        {analysis.opportunity_signals.filter((o) => o.type !== "at_risk" && o.type !== "closed_lost").length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <TrendUp className="size-3.5 text-muted-foreground" /> Opportunities
            </h3>
            <div className="space-y-2">
              {analysis.opportunity_signals
                .filter((o) => o.type !== "at_risk" && o.type !== "closed_lost")
                .map((opp, i) => (
                  <div
                    key={i}
                    className="text-sm p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase font-bold">
                        {opp.type.replace("_", " ")}
                      </span>
                      {opp.estimated_value && (
                        <span className="text-xs text-foreground font-semibold">{opp.estimated_value}</span>
                      )}
                    </div>
                    <p>{opp.description}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Events Mentioned */}
        {analysis.events_mentioned.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Events Mentioned</h3>
            <div className="space-y-2">
              {analysis.events_mentioned.map((event, i) => {
                const eventName = typeof event === "string" ? event : event.event;
                const eventContext = typeof event === "string" ? null : event.context;
                return (
                  <div key={i} className="p-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06]">
                    <p className="text-sm font-medium">{eventName}</p>
                    {eventContext && (
                      <p className="text-xs text-muted-foreground mt-0.5">{eventContext}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Talk-to-Listen Ratio */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Talk-to-Listen Ratio</h3>
          <div className="flex items-center gap-0.5 h-4 rounded-full overflow-hidden bg-foreground/[0.04]">
            <div
              className="bg-primary h-full rounded-l-full transition-all"
              style={{ width: `${agentPct}%` }}
            />
            <div
              className="bg-foreground/15 h-full rounded-r-full transition-all"
              style={{ width: `${analysis.talk_to_listen_ratio.contact_pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs font-medium text-primary tabular-nums">
              Agent {agentPct}%
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              Contact {analysis.talk_to_listen_ratio.contact_pct}%
            </span>
          </div>
          {ratioNote && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 italic">{ratioNote}</p>
          )}
        </div>

        {/* Coaching Notes */}
        {analysis.coaching_notes && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faLightbulb} className="h-3.5 w-3.5 text-muted-foreground" /> Coaching
            </h3>
            <p className="text-sm p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06]">
              {analysis.coaching_notes}
            </p>
          </div>
        )}

        {/* Draft Follow-up */}
        {analysis.draft_follow_up && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <ChatText className="size-3.5" /> Suggested Follow-up
              </h3>
              <button
                onClick={() => copyText(analysis.draft_follow_up!, "followup")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {copiedField === "followup" ? <CheckCircle className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copiedField === "followup" ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-sm p-4 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06] whitespace-pre-line italic">
              {analysis.draft_follow_up}
            </div>
          </div>
        )}

        {/* Transcript Preview */}
        {transcript && (
          <div className="mb-6">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <Eye className="size-3.5" />
              <span>View Transcript</span>
              {showTranscript ? <CaretUp className="size-3.5 ml-auto" /> : <CaretDown className="size-3.5 ml-auto" />}
            </button>
            {showTranscript && (
              <div className="mt-2 p-4 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06] max-h-96 overflow-y-auto">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/80">
                  {transcript}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Digest Section Component ──

function DigestSection({
  title,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl bg-card border border-border/50 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
        <Icon className="size-[18px] text-muted-foreground" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

// ── Digest Copy Button ──

function DigestCopyButton({ digest, eventRecap }: { digest: DailyDigest; eventRecap: EventRecapData | null }) {
  const [copied, setCopied] = useState(false);

  const formatDigestText = () => {
    const lines: string[] = [];
    lines.push(`📊 AI SALES DIGEST — ${digest.period}`);
    lines.push(`Generated: ${new Date(digest.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${digest.total_calls_analysed} calls analysed`);
    lines.push("");

    if (eventRecap) {
      lines.push("━━━ TODAY'S RECAP ━━━");
      if (eventRecap.totalDealValue > 0) lines.push(`💰 Deals Closed: £${Math.round(eventRecap.totalDealValue).toLocaleString()}`);
      if (eventRecap.dealsClosedToday.length > 0) lines.push(`📋 Bookings: ${eventRecap.dealsClosedToday.length}`);
      if (eventRecap.leadsCreatedToday > 0) lines.push(`👤 New Leads: ${eventRecap.leadsCreatedToday}`);
      if (eventRecap.callStats) lines.push(`📞 Calls: ${eventRecap.callStats.total}`);
      lines.push("");
    }

    lines.push("━━━ TEAM SUMMARY ━━━");
    lines.push(digest.team_summary);
    lines.push("");

    if (digest.top_objections.length > 0) {
      lines.push("━━━ OBJECTION RADAR ━━━");
      digest.top_objections.forEach((obj) => {
        lines.push(`• ${obj.objection} (${obj.frequency}x)`);
        lines.push(`  → ${obj.suggested_response}`);
      });
      lines.push("");
    }

    if (digest.winning_pitches.length > 0) {
      lines.push("━━━ WHAT'S WORKING ━━━");
      digest.winning_pitches.forEach((p) => {
        lines.push(`• ${p.description} — ${p.rep}`);
      });
      lines.push("");
    }

    if (digest.event_demand.length > 0) {
      lines.push("━━━ EVENT DEMAND ━━━");
      digest.event_demand.forEach((e) => {
        lines.push(`• ${e.event}: ${e.mentions} mentions — ${e.sentiment}`);
      });
      lines.push("");
    }

    if (digest.competitor_intelligence.length > 0) {
      lines.push("━━━ COMPETITOR INTEL ━━━");
      digest.competitor_intelligence.forEach((c) => {
        lines.push(`• ${c.competitor} (${c.mentions}x) — ${c.context}`);
      });
      lines.push("");
    }

    if (digest.coaching_highlights.length > 0) {
      lines.push("━━━ COACHING INSIGHTS ━━━");
      const strengths = digest.coaching_highlights.filter(h => h.type === "strength");
      const improvements = digest.coaching_highlights.filter(h => h.type === "improvement");
      if (strengths.length > 0) {
        lines.push("Strengths:");
        strengths.forEach((h) => lines.push(`  ✅ ${h.rep}: ${h.description}`));
      }
      if (improvements.length > 0) {
        lines.push("Areas for Improvement:");
        improvements.forEach((h) => lines.push(`  💡 ${h.rep}: ${h.description}`));
      }
      lines.push("");
    }

    if (digest.key_deals.length > 0) {
      lines.push("━━━ KEY DEALS ━━━");
      digest.key_deals.forEach((d) => {
        lines.push(`• ${d.contact} (${d.rep}): ${d.status}`);
        lines.push(`  → ${d.next_steps}`);
      });
      lines.push("");
    }

    if (digest.follow_up_gaps.length > 0) {
      lines.push("━━━ FOLLOW-UP GAPS ━━━");
      digest.follow_up_gaps.forEach((g) => {
        lines.push(`• ${g.rep}: ${g.description}`);
      });
    }

    return lines.join("\n");
  };

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(formatDigestText()).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/50 bg-card hover:bg-muted/50 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      {copied ? <CheckCircle className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── Metric Card ──

// ── Gap Rep Row (Dial Pace leaderboard) ──

// ── Pace Ring Chart (SVG Donut) ──

function PaceRingChart({
  reps,
  teamAvg,
}: {
  reps: { avg_gap_seconds: number; gap_count: number }[];
  teamAvg: number;
}) {
  const RADIUS = 76;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const buckets = [
    { label: "< 2min", min: 0, max: 120, count: 0, color: "#10b981" },
    { label: "2–5min", min: 120, max: 300, count: 0, color: "#f59e0b" },
    { label: "> 5min", min: 300, max: Infinity, count: 0, color: "#ef4444" },
  ];

  const activeReps = reps.filter((r) => r.gap_count > 0);
  for (const rep of activeReps) {
    for (const bucket of buckets) {
      if (rep.avg_gap_seconds >= bucket.min && rep.avg_gap_seconds < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  const total = activeReps.length || 1;
  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 200 200" className="w-44 h-44 -rotate-90">
          <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="hsl(var(--muted))" strokeWidth="22" strokeOpacity="0.2" />
          {buckets.map((bucket) => {
            const fraction = bucket.count / total;
            const dashLength = fraction * CIRCUMFERENCE;
            const gapLength = CIRCUMFERENCE - dashLength;
            const offset = -cumulativeOffset;
            cumulativeOffset += dashLength;
            if (bucket.count === 0) return null;
            return (
              <motion.circle
                key={bucket.label}
                cx="100" cy="100" r={RADIUS}
                fill="none"
                stroke={bucket.color}
                strokeWidth="22"
                strokeLinecap="butt"
                strokeDasharray={`${dashLength} ${gapLength}`}
                strokeDashoffset={offset}
                initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
                animate={{ strokeDasharray: `${dashLength} ${gapLength}` }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`text-xl font-bold tabular-nums ${gapColorClass(teamAvg)}`}>
            {formatGapShort(teamAvg)}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Team Avg</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: b.color }} />
            <span className="text-[11px] text-muted-foreground">
              {b.label} <span className="font-semibold text-foreground">{b.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline Metric Chip ──

function MetricChip({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-base font-bold tabular-nums ${colorClass || "text-foreground"}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── Accordion Rep Row (Leaderboard + inline drill-down) ──

function GapRepRowAccordion({
  rep,
  index,
  isExpanded,
  onToggle,
  gapDetail,
  gapDetailLoading,
}: {
  rep: {
    aircall_user_id: number;
    rep_name: string;
    current_idle_seconds: number;
    avg_gap_seconds: number;
    max_gap_seconds: number;
    min_gap_seconds: number;
    gap_count: number;
    gaps_over_5min: number;
    total_calls: number;
    total_idle_time: number;
    last_call_ended_at: number;
  };
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  gapDetail: {
    gaps: { previous_call_ended_at: number; current_call_started_at: number; gap_seconds: number }[];
    summary: { avg_gap_seconds: number; max_gap_seconds: number; min_gap_seconds: number } | null;
  } | null;
  gapDetailLoading: boolean;
}) {
  const [liveIdle, setLiveIdle] = useState(rep.current_idle_seconds);

  useEffect(() => {
    setLiveIdle(rep.current_idle_seconds);
  }, [rep.current_idle_seconds]);

  useEffect(() => {
    if (rep.last_call_ended_at === 0 || liveIdle === 0) return;
    const interval = setInterval(() => setLiveIdle((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep.last_call_ended_at]);

  const showIdle = liveIdle > 0 && liveIdle < 3600;

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left ${
          isExpanded ? "bg-white/[0.06]" : "hover:bg-foreground/[0.03]"
        }`}
      >
        <div className={`size-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
          index === 0 ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900"
          : index === 1 ? "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700"
          : index === 2 ? "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100"
          : "bg-muted/60 text-muted-foreground"
        }`}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">{rep.rep_name}</p>
          <p className="text-[10px] text-muted-foreground/60 tabular-nums">
            {rep.total_calls} calls · {rep.gap_count} gaps
            {rep.gaps_over_5min > 0 && <span className="text-red-500 ml-1">{rep.gaps_over_5min} over 5m</span>}
          </p>
        </div>
        {showIdle && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium tabular-nums ${gapBgClass(liveIdle)}`}>
            {formatGapShort(liveIdle)}
          </span>
        )}
        <div className="text-right shrink-0 w-14">
          <p className={`text-sm font-bold tabular-nums ${rep.gap_count > 0 ? gapColorClass(rep.avg_gap_seconds) : "text-muted-foreground"}`}>
            {rep.gap_count > 0 ? formatGapShort(rep.avg_gap_seconds) : "—"}
          </p>
        </div>
        <CaretDown className={`size-3.5 text-muted-foreground/40 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 ml-8 border-l border-border/30">
              {gapDetailLoading ? (
                <div className="py-3 flex justify-center">
                  <SpinnerGap className="size-4 text-primary animate-spin" />
                </div>
              ) : gapDetail && gapDetail.gaps.length > 0 ? (
                <>
                  {gapDetail.summary && (
                    <div className="flex items-center gap-4 mb-2 py-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] text-muted-foreground">Avg</span>
                        <span className={`text-xs font-bold tabular-nums ${gapColorClass(gapDetail.summary.avg_gap_seconds)}`}>{formatGapShort(gapDetail.summary.avg_gap_seconds)}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] text-muted-foreground">Max</span>
                        <span className="text-xs font-bold tabular-nums text-red-500">{formatGapShort(gapDetail.summary.max_gap_seconds)}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] text-muted-foreground">Min</span>
                        <span className="text-xs font-bold tabular-nums text-emerald-500">{formatGapShort(gapDetail.summary.min_gap_seconds)}</span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {gapDetail.gaps.map((gap, i) => (
                      <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
                        <div className={`size-1.5 rounded-full shrink-0 ${
                          gap.gap_seconds <= 120 ? "bg-emerald-500" : gap.gap_seconds <= 300 ? "bg-amber-500" : "bg-red-500"
                        }`} />
                        <span className="text-muted-foreground/60 tabular-nums">
                          {formatTime(gap.previous_call_ended_at)} → {formatTime(gap.current_call_started_at)}
                        </span>
                        <span className={`font-bold tabular-nums ml-auto ${gapColorClass(gap.gap_seconds)}`}>
                          {formatGapShort(gap.gap_seconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-2">No gaps recorded</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Live Rep Status Row ──

function LiveRepStatus({ rep }: { rep: { aircall_user_id: number; rep_name: string; current_idle_seconds: number; last_call_ended_at: number } }) {
  const [idle, setIdle] = useState(rep.current_idle_seconds);

  useEffect(() => {
    setIdle(rep.current_idle_seconds);
  }, [rep.current_idle_seconds]);

  useEffect(() => {
    if (rep.last_call_ended_at === 0 || idle === 0) return;
    const interval = setInterval(() => setIdle((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep.last_call_ended_at]);

  const isOnCall = idle === 0;
  const needsAttention = idle > 300;

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${needsAttention ? "bg-red-500/[0.05]" : ""}`}>
      <div className="relative">
        <div className={`size-2 rounded-full ${isOnCall ? "bg-emerald-500" : idle <= 120 ? "bg-emerald-400" : idle <= 300 ? "bg-amber-400" : "bg-red-500"}`} />
        {isOnCall && <div className="absolute inset-0 size-2 rounded-full bg-emerald-500 animate-ping" />}
      </div>
      <p className="text-sm font-medium truncate flex-1">{rep.rep_name}</p>
      {isOnCall ? (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
          On Call
        </span>
      ) : (
        <span className={`text-xs font-bold tabular-nums ${gapColorClass(idle)}`}>
          {formatGapShort(idle)}
        </span>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  isText,
  highlight,
  highlightColor,
  loading,
  delay = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  isText?: string;
  highlight?: string;
  highlightColor?: "green" | "red";
  loading: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl bg-card border border-border/50 p-4"
    >
      {loading ? (
        <div>
          <div className="animate-pulse bg-muted/40 h-9 w-16 rounded-lg mb-2" />
          <div className="animate-pulse bg-muted/30 h-3 w-14 rounded" />
        </div>
      ) : (
        <div>
          <div className="text-3xl font-bold tabular-nums tracking-tight">
            {isText ? (
              isText
            ) : (
              <>
                <NumberFlow
                  value={value}
                  transformTiming={{ duration: 500, easing: "ease-out" }}
                  spinTiming={{ duration: 400, easing: "ease-out" }}
                />
                {suffix && <span className="text-xl text-muted-foreground/60 ml-0.5">{suffix}</span>}
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1.5 font-medium">{label}</p>
          {highlight && (
            <p
              className={`text-sm font-semibold mt-0.5 ${
                highlightColor === "green"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : highlightColor === "red"
                    ? "text-red-500 dark:text-red-400"
                    : "text-muted-foreground"
              }`}
            >
              {highlight}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ──

export default function CallsPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState<CallPeriod>("today");
  const [callData, setCallData] = useState<CallDataResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenView, setFullscreenView] = useState<FullscreenView>(null);

  // Intelligence tab state
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [callAnalysis, setCallAnalysis] = useState<CallAnalysis | null>(null);
  const [callTranscript, setCallTranscript] = useState<string | null>(null);

  // Digest tab state — restore from sessionStorage if available
  const [digest, setDigest] = useState<DailyDigest | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = sessionStorage.getItem('calls_digest_today');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  // Event recap state
  const [eventRecap, setEventRecap] = useState<EventRecapData | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);

  // Transcript search tab state
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [transcriptResults, setTranscriptResults] = useState<TranscriptSearchResult[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptCount, setTranscriptCount] = useState<number | null>(null);
  const [transcriptFromDate, setTranscriptFromDate] = useState("");
  const [transcriptToDate, setTranscriptToDate] = useState("");
  const [transcriptDirection, setTranscriptDirection] = useState<"" | "inbound" | "outbound">("");
  const [hasSearched, setHasSearched] = useState(false);

  // Dial Pace tab state
  const [gapData, setGapData] = useState<{
    reps: {
      aircall_user_id: number;
      rep_name: string;
      last_call_ended_at: number;
      current_idle_seconds: number;
      avg_gap_seconds: number;
      max_gap_seconds: number;
      min_gap_seconds: number;
      gap_count: number;
      gaps_over_5min: number;
      total_idle_time: number;
      total_calls: number;
    }[];
    team_avg_gap_seconds: number;
    team_total_reps: number;
    team_total_gaps: number;
  } | null>(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [selectedGapRep, setSelectedGapRep] = useState<number | null>(null);
  const [gapDetail, setGapDetail] = useState<{
    gaps: { previous_call_id: number; previous_call_ended_at: number; previous_call_direction: string; current_call_id: number; current_call_started_at: number; current_call_direction: string; gap_seconds: number }[];
    summary: { rep_name: string; avg_gap_seconds: number; max_gap_seconds: number; min_gap_seconds: number; gap_count: number; total_idle_time: number; total_calls: number } | null;
  } | null>(null);
  const [gapDetailLoading, setGapDetailLoading] = useState(false);
  const gapPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);
  const previousPeriodRef = useRef<CallPeriod | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // Close overlays on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedCallId) {
          setSelectedCallId(null);
          setCallAnalysis(null);
        } else {
          setFullscreenView(null);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedCallId]);

  // ── Fetch call data ──

  const fetchCallData = useCallback(
    async (silent = false) => {
      if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
      if (silent) setIsRefreshing(true);
      setError(null);

      try {
        const response = await fetch(`/api/calls/data?period=${period}`);
        if (!response.ok) throw new Error("Failed to fetch call data");
        const result = await response.json();
        if (result.success) {
          setCallData(result.data);
          setLastUpdated(new Date());
          hasFetchedOnce.current = true;
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (err) {
        console.error("Error fetching call data:", err);
        if (!hasFetchedOnce.current)
          setError("Failed to load call data. Check Aircall connection.");
      } finally {
        setInitialLoading(false);
        setPeriodLoading(false);
        setIsRefreshing(false);
      }
    },
    [period]
  );

  useEffect(() => {
    if (!user) return;

    const isPeriodChange =
      previousPeriodRef.current !== null && previousPeriodRef.current !== period;

    if (isPeriodChange) {
      setPeriodLoading(true);
    }

    previousPeriodRef.current = period;
    fetchCallData(hasFetchedOnce.current);

    // Restore cached digest for this period
    try {
      const cached = sessionStorage.getItem(`calls_digest_${period}`);
      setDigest(cached ? JSON.parse(cached) : null);
    } catch { setDigest(null); }
  }, [user, period, fetchCallData]);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(() => fetchCallData(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, fetchCallData]);

  // ── Fetch gap data (Dial Pace tab) ──

  const fetchGapData = useCallback(async () => {
    try {
      const res = await fetch("/api/calls/gaps");
      if (!res.ok) return;
      const result = await res.json();
      if (result.success) {
        setGapData(result.data);
      }
    } catch (err) {
      console.error("Error fetching gap data:", err);
    }
  }, []);

  // Fetch gap data — poll on dial-pace tab, one-shot on overview tab
  useEffect(() => {
    if (!user) return;

    if (activeTab === "dial-pace") {
      setGapLoading(true);
      fetchGapData().finally(() => setGapLoading(false));
      gapPollRef.current = setInterval(fetchGapData, 30_000);
      return () => {
        if (gapPollRef.current) clearInterval(gapPollRef.current);
      };
    }

    if (activeTab === "overview") {
      // One-shot fetch for the Team Avg Gap KPI card (no polling)
      fetchGapData();
    }

    // Cleanup polling if switching away from dial-pace
    if (gapPollRef.current) clearInterval(gapPollRef.current);
  }, [user, activeTab, fetchGapData]);

  const fetchGapDetail = useCallback(async (userId: number) => {
    setSelectedGapRep(userId);
    setGapDetailLoading(true);
    setGapDetail(null);
    try {
      const res = await fetch(`/api/calls/gaps/detail?user_id=${userId}`);
      if (!res.ok) return;
      const result = await res.json();
      if (result.success) {
        setGapDetail(result.data);
      }
    } catch (err) {
      console.error("Error fetching gap detail:", err);
    } finally {
      setGapDetailLoading(false);
    }
  }, []);

  // ── Analyse a single call ──

  const analyseCallById = async (callId: number) => {
    setSelectedCallId(callId);

    // Check sessionStorage for cached analysis first
    try {
      const cached = sessionStorage.getItem(`call_analysis_${callId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCallAnalysis(parsed.analysis || parsed);
        setCallTranscript(parsed.transcript || null);
        setAnalysisLoading(false);
        return;
      }
    } catch {}

    setAnalysisLoading(true);
    setCallAnalysis(null);
    setCallTranscript(null);

    try {
      const response = await fetch("/api/calls/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: callId }),
      });
      const result = await response.json();
      if (result.success) {
        setCallAnalysis(result.data);
        setCallTranscript(result.transcript || null);
        try { sessionStorage.setItem(`call_analysis_${callId}`, JSON.stringify({ analysis: result.data, transcript: result.transcript || null })); } catch {}
      } else {
        console.error("Analysis failed:", result.error);
        alert(result.error || "Failed to analyse call. It may not have a transcript.");
        setSelectedCallId(null);
      }
    } catch (err) {
      console.error("Error analysing call:", err);
      setSelectedCallId(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // ── Generate digest ──

  const generateDigest = async (forceRefresh = false) => {
    setDigestLoading(true);
    setDigestError(null);

    try {
      const response = await fetch("/api/calls/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, force_refresh: forceRefresh }),
      });
      const result = await response.json();
      if (result.success) {
        setDigest(result.data);
        try { sessionStorage.setItem(`calls_digest_${period}`, JSON.stringify(result.data)); } catch {}
      } else {
        console.error("Digest generation failed:", result.error);
        setDigestError(result.error || "Failed to generate digest.");
      }
    } catch (err) {
      console.error("Error generating digest:", err);
      setDigestError("Failed to generate digest.");
    } finally {
      setDigestLoading(false);
    }
  };

  // ── Fetch event recap ──

  const fetchEventRecap = async (forceRefresh = false) => {
    setRecapLoading(true);
    try {
      const response = await fetch("/api/calls/event-recap", {
        method: forceRefresh ? "POST" : "GET",
        ...(forceRefresh
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ force_refresh: true }),
            }
          : {}),
      });
      const result = await response.json();
      if (result.success) {
        setEventRecap(result.data);
      }
    } catch (err) {
      console.error("Error fetching event recap:", err);
    } finally {
      setRecapLoading(false);
    }
  };

  // Auto-load recap when switching to digest tab
  useEffect(() => {
    if (activeTab === "digest" && !eventRecap && !recapLoading) {
      fetchEventRecap();
    }
  }, [activeTab, eventRecap, recapLoading]);

  // ── Search transcripts ──

  const searchTranscripts = async () => {
    if (!transcriptQuery.trim()) return;
    setTranscriptLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({ keyword: transcriptQuery.trim() });
      if (transcriptFromDate) params.set("fromDate", transcriptFromDate);
      if (transcriptToDate) params.set("toDate", transcriptToDate);
      if (transcriptDirection) params.set("direction", transcriptDirection);

      const response = await fetch(`/api/calls/transcripts?${params}`);
      const result = await response.json();
      if (result.success) {
        setTranscriptResults(result.data.results || []);
        if (result.data.totalStored !== undefined) {
          setTranscriptCount(result.data.totalStored);
        }
      }
    } catch (err) {
      console.error("Transcript search error:", err);
    } finally {
      setTranscriptLoading(false);
    }
  };

  // Fetch stored transcript count on tab switch
  useEffect(() => {
    if (activeTab === "transcripts" && transcriptCount === null) {
      fetch("/api/calls/transcripts?keyword=&limit=0")
        .then((r) => r.json())
        .then((result) => {
          if (result.success && result.data?.totalStored !== undefined) {
            setTranscriptCount(result.data.totalStored);
          }
        })
        .catch(() => {});
    }
  }, [activeTab, transcriptCount]);

  // ── Derived values ──
  const stats = callData?.stats;
  const repStats = callData?.repStats || [];
  const recentCalls = callData?.recentCalls || [];
  const analysableCalls = callData?.analysableCalls || [];
  const hourlyData = callData?.hourlyDistribution || {};
  const maxRepCalls = repStats.length > 0 ? repStats[0].total_calls : 0;

  const answerRate = stats && stats.total_calls > 0 ? ((stats.answered_calls / stats.total_calls) * 100).toFixed(1) : "0";
  const missRate = stats && stats.total_calls > 0 ? ((stats.missed_calls / stats.total_calls) * 100).toFixed(1) : "0";

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
    <>
      {/* Fullscreen overlay */}
      <FullscreenModal
        view={fullscreenView}
        onClose={() => setFullscreenView(null)}
        repStats={repStats}
        recentCalls={recentCalls}
        maxRepCalls={maxRepCalls}
        period={period}
        onCallClick={analyseCallById}
      />

      {/* Analysis slide-over panel */}
      <AnimatePresence>
        {selectedCallId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm pointer-events-none"
            />
            {analysisLoading ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="fixed inset-y-0 right-0 w-full max-w-xl z-50 bg-background border-l border-border flex items-center justify-center"
              >
                <div className="text-center">
                  <Brain className="size-10 text-primary mx-auto mb-4 animate-pulse" />
                  <p className="text-lg font-semibold mb-1">Analysing Call</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Transcribing with Deepgram Nova-3 → Analysing with Claude...
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-2">This may take 15-30 seconds</p>
                </div>
              </motion.div>
            ) : callAnalysis ? (
              <AnalysisPanel
                analysis={callAnalysis}
                transcript={callTranscript}
                onClose={() => {
                  setSelectedCallId(null);
                  setCallAnalysis(null);
                  setCallTranscript(null);
                }}
                onTopicClick={(topic) => {
                  setSelectedCallId(null);
                  setCallAnalysis(null);
                  setCallTranscript(null);
                  setActiveTab("transcripts");
                  setTranscriptQuery(topic);
                  // Trigger search after state update
                  setTimeout(() => {
                    const params = new URLSearchParams({ keyword: topic.trim() });
                    if (transcriptFromDate) params.set("fromDate", transcriptFromDate);
                    if (transcriptToDate) params.set("toDate", transcriptToDate);
                    if (transcriptDirection) params.set("direction", transcriptDirection);
                    setTranscriptLoading(true);
                    setHasSearched(true);
                    fetch(`/api/calls/transcripts?${params}`)
                      .then((r) => r.json())
                      .then((result) => {
                        if (result.success) {
                          setTranscriptResults(result.data.results || []);
                          if (result.data.totalStored !== undefined) {
                            setTranscriptCount(result.data.totalStored);
                          }
                        }
                      })
                      .catch(console.error)
                      .finally(() => setTranscriptLoading(false));
                  }, 50);
                }}
              />
            ) : null}
          </>
        )}
      </AnimatePresence>

      <div className="min-h-dvh bg-gradient-to-br from-background to-muted/20 p-6 pl-24 lg:p-8 lg:pl-24">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* ═══ Unified Header: Title + Tabs + Period ═══ */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-card border border-border/60 shadow-sm dark:shadow-none rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4"
          >
            {/* Left: Title */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Phone className="size-5 text-foreground" weight="bold" />
              <h1 className="text-lg font-bold tracking-tight">Calls</h1>
            </div>

            {/* Center: Tab pills */}
            <div className="flex rounded-xl p-1 overflow-x-auto scrollbar-hide bg-gray-100 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.06] shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.key
                      ? "bg-white dark:bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_14px_rgba(0,0,0,0.2)] ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <tab.icon className="size-3.5" weight={activeTab === tab.key ? "fill" : "regular"} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right: Period selector + refresh */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex rounded-lg p-0.5 bg-gray-100 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.06] shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 ${
                      period === p.key
                        ? "bg-white dark:bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_14px_rgba(0,0,0,0.2)] ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {period === p.key && periodLoading && (
                      <SpinnerGap className="size-3 animate-spin text-gray-900" />
                    )}
                    {p.key === "today" ? "Today" : p.key === "week" ? "Week" : "Month"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchCallData(true)}
                disabled={isRefreshing}
                className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Refresh"
              >
                <ArrowsClockwise className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </motion.div>

          {/* ── Error ── */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-sm"
            >
              {error}
              <button onClick={() => fetchCallData()} className="ml-2 underline hover:opacity-80">
                Try again
              </button>
            </motion.div>
          )}

          {periodLoading && callData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-4 py-3 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] text-sm text-muted-foreground flex items-center gap-2"
            >
              <SpinnerGap className="size-4 animate-spin" />
              Loading {periodLabel(period)} call data...
            </motion.div>
          )}

          {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* ═══ Section 2: Metric Cards ═══ */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                  <MetricCard
                    label="Total Calls"
                    value={stats?.total_calls || 0}
                    loading={initialLoading}
                    delay={0.15}
                  />
                  <MetricCard
                    label="Answered"
                    value={stats?.answered_calls || 0}
                    highlight={stats && stats.total_calls > 0 ? `${answerRate}% rate` : undefined}
                    highlightColor="green"
                    loading={initialLoading}
                    delay={0.2}
                  />
                  <MetricCard
                    label="Missed"
                    value={stats?.missed_calls || 0}
                    highlight={stats && stats.missed_calls > 0 ? `${missRate}% rate` : undefined}
                    highlightColor="red"
                    loading={initialLoading}
                    delay={0.25}
                  />
                  <MetricCard
                    label="Avg Duration"
                    value={0}
                    isText={formatDurationShort(Math.round(stats?.avg_duration || 0))}
                    loading={initialLoading}
                    delay={0.3}
                  />
                  <MetricCard
                    label="Talk Time"
                    value={0}
                    isText={formatDuration(stats?.total_talk_time || 0)}
                    loading={initialLoading}
                    delay={0.35}
                  />
                  <MetricCard
                    label="Team Avg Gap"
                    value={0}
                    isText={gapData ? formatGapShort(gapData.team_avg_gap_seconds) : "—"}
                    highlight={gapData && gapData.team_total_gaps > 0 ? `${gapData.team_total_gaps} gaps` : undefined}
                    highlightColor={gapData && gapData.team_avg_gap_seconds > 300 ? "red" : "green"}
                    loading={initialLoading}
                    delay={0.4}
                  />
                </div>

                {/* ═══ Section 3: Activity Chart (full width) ═══ */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-card border border-border/50 overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Pulse className="size-[18px] text-muted-foreground" />
                      <h2 className="text-base font-semibold">Call Activity</h2>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-blue-500/60 dark:bg-blue-400/50" />
                        Outbound
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-violet-500/40 dark:bg-violet-400/35" />
                        Inbound
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    {initialLoading ? (
                      <div className="h-44 flex items-end gap-1 px-1">
                        {Array.from({ length: 12 }).map((_, i) => {
                          const h1 = 20 + Math.floor(Math.random() * 70);
                          const h2 = 10 + Math.floor(Math.random() * 50);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                              <div className="w-full flex flex-col items-stretch">
                                <div
                                  className="w-full animate-pulse bg-blue-500/15 rounded-t-sm"
                                  style={{ height: `${h1}px` }}
                                />
                                <div
                                  className="w-full animate-pulse bg-violet-500/10 rounded-b-sm"
                                  style={{ height: `${h2}px` }}
                                />
                              </div>
                              <div className="animate-pulse bg-muted/20 h-2 w-4 rounded" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <ActivityChart data={hourlyData} />
                    )}
                  </div>
                </motion.div>

                {/* ═══ Section 4: Rep Leaderboard + Recent Calls ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Rep Leaderboard */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="rounded-2xl bg-card border border-border/50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon icon={faTrophy} className="h-[18px] w-[18px] text-yellow-500" />
                        <h2 className="text-base font-semibold">Calls by Rep</h2>
                        <span className="text-xs text-muted-foreground">{periodLabel(period)}</span>
                      </div>
                      <button
                        onClick={() => setFullscreenView("reps")}
                        className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="View rep leaderboard fullscreen"
                      >
                        <ArrowsOut className="size-[18px]" />
                      </button>
                    </div>
                    <div className="p-3 max-h-[440px] overflow-y-auto scrollbar-hide">
                      {initialLoading ? (
                        <div className="space-y-2 p-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                              <div className="animate-pulse bg-muted/40 size-8 rounded-full" />
                              <div className="flex-1">
                                <div className="animate-pulse bg-muted/40 h-3 w-24 rounded mb-2" />
                                <div className="animate-pulse bg-muted/30 h-1.5 w-full rounded" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : repStats.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Users className="size-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">No call data yet</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {repStats.map((rep, i) => (
                            <RepRow key={rep.user_id} rep={rep} index={i} maxCalls={maxRepCalls} />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Recent Calls */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="rounded-2xl bg-card border border-border/50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <Phone className="size-[18px] text-muted-foreground" />
                        <h2 className="text-base font-semibold">Recent Calls</h2>
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                          Click to analyse
                        </span>
                      </div>
                      <button
                        onClick={() => setFullscreenView("calls")}
                        className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="View recent calls fullscreen"
                      >
                        <ArrowsOut className="size-[18px]" />
                      </button>
                    </div>
                    <div className="p-2 max-h-[440px] overflow-y-auto scrollbar-hide">
                      {initialLoading ? (
                        <div className="space-y-1 p-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                              <div className="animate-pulse bg-muted/40 size-9 rounded-full" />
                              <div className="flex-1">
                                <div className="animate-pulse bg-muted/40 h-3 w-28 rounded mb-2" />
                                <div className="animate-pulse bg-muted/30 h-2.5 w-20 rounded" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : recentCalls.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Phone className="size-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">No calls yet</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {recentCalls.map((call) => (
                            <CallRow
                              key={call.id}
                              call={call}
                              onClick={() => {
                                if (call.has_recording) {
                                  analyseCallById(call.id);
                                }
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ═══════════════ INTELLIGENCE TAB ═══════════════ */}
            {activeTab === "intelligence" && (
              <motion.div
                key="intelligence"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold tracking-tight">AI Call Analysis</h2>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium tabular-nums">
                        {callData?.meaningfulCallCount || 0} calls
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click any call to transcribe and analyse with AI
                    </p>
                  </div>
                </motion.div>

                {/* Call list for analysis */}
                {initialLoading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50">
                        <div className="animate-pulse bg-muted/40 size-11 rounded-xl" />
                        <div className="flex-1">
                          <div className="animate-pulse bg-muted/40 h-4 w-32 rounded mb-2" />
                          <div className="animate-pulse bg-muted/30 h-3 w-48 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {analysableCalls.map((call, index) => (
                      <motion.button
                        key={call.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => analyseCallById(call.id)}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 hover:bg-muted/30 hover:border-foreground/15 transition-all text-left group"
                      >
                        <div className="size-11 rounded-xl flex items-center justify-center shrink-0 bg-muted/40 text-muted-foreground">
                          {call.direction === "inbound" ? (
                            <PhoneIncoming className="size-5" />
                          ) : (
                            <PhoneOutgoing className="size-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{call.contact_name}</p>
                          <p className="text-xs text-muted-foreground truncate tabular-nums">
                            {call.agent_name} · {formatDuration(call.duration)} · {formatTime(call.started_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 opacity-0 group-hover:opacity-100 transition-opacity">
                            Analyse
                          </span>
                          <CaretRight className="size-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}

                {analysableCalls.length === 0 && !initialLoading && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Brain className="size-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold mb-1">No analysable calls yet</p>
                    <p className="text-sm">
                      Calls longer than 3 minutes will appear here for AI analysis
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════════════ AI DIGEST TAB ═══════════════ */}
            {activeTab === "digest" && (
              <motion.div
                key="digest"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold tracking-tight">AI Sales Digest</h2>
                      {digest && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium tabular-nums">
                          {digest.total_calls_analysed} calls
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {digest
                        ? `Generated ${new Date(digest.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                        : "AI analyses call transcripts, deals, and team activity to generate actionable insights"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {digest && (
                      <DigestCopyButton digest={digest} eventRecap={eventRecap} />
                    )}
                    <button
                      onClick={() => generateDigest(true)}
                      disabled={digestLoading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 shadow-lg"
                    >
                      {digestLoading ? (
                        <SpinnerGap className="size-4 animate-spin" />
                      ) : (
                        <ArrowsClockwise className="size-4" />
                      )}
                      {digestLoading ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </motion.div>

                {digestError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300"
                  >
                    {digestError}
                  </motion.div>
                )}

                {digestLoading && !digest ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20"
                  >
                    <MagicWand className="size-12 text-primary mx-auto mb-4 animate-pulse" />
                    <p className="text-lg font-semibold mb-2">Generating AI Digest</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Fetching call transcripts, analysing conversations with AI, and building your team intelligence report...
                    </p>
                  </motion.div>
                ) : digest ? (
                  <div className="space-y-5">
                    {/* ── Today's Recap ── */}
                    {eventRecap && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl bg-card border border-border/50 overflow-hidden"
                      >
                        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Confetti className="size-[18px] text-amber-500" />
                            <h3 className="text-base font-semibold">Today&apos;s Recap</h3>
                            <span className="text-xs text-muted-foreground">
                              {new Date(eventRecap.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <button
                            onClick={() => fetchEventRecap(true)}
                            disabled={recapLoading}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {recapLoading ? "Refreshing..." : "Refresh"}
                          </button>
                        </div>
                        <div className="p-5">
                          {/* Recap metric cards — only show cards with meaningful data */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                            {eventRecap.totalDealValue > 0 && (
                              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-center">
                                <Briefcase className="size-5 text-emerald-500 mx-auto mb-1.5" />
                                <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                  £{Math.round(eventRecap.totalDealValue).toLocaleString()}
                                </p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                  Deals Closed
                                </p>
                              </div>
                            )}
                            {eventRecap.dealsClosedToday.length > 0 && (
                              <div className="rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] p-3 text-center">
                                <CalendarCheck className="size-5 text-blue-500 mx-auto mb-1.5" />
                                <p className="text-xl font-bold tabular-nums">{eventRecap.dealsClosedToday.length}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                  Bookings Today
                                </p>
                              </div>
                            )}
                            {eventRecap.leadsCreatedToday > 0 && (
                              <div className="rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] p-3 text-center">
                                <UserPlus className="size-5 text-violet-500 mx-auto mb-1.5" />
                                <p className="text-xl font-bold tabular-nums">{eventRecap.leadsCreatedToday}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                  New Leads
                                </p>
                              </div>
                            )}
                            {eventRecap.callStats && (
                              <div className="rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] p-3 text-center">
                                <Phone className="size-5 text-amber-500 mx-auto mb-1.5" />
                                <p className="text-xl font-bold tabular-nums">{eventRecap.callStats.total}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                  Calls Today
                                </p>
                                {eventRecap.callStats.total > 0 && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                                    {Math.round((eventRecap.callStats.answered / eventRecap.callStats.total) * 100)}% answered
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Deals closed — hide detailed list when AI digest has richer Key Deals section */}
                          {eventRecap.dealsClosedToday.length > 0 && !(digest && digest.key_deals.length > 0) && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Deals Closed Today</p>
                              <div className="space-y-2">
                                {eventRecap.dealsClosedToday.map((deal, i) => (
                                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{deal.name}</p>
                                      <p className="text-xs text-muted-foreground">{deal.owner} · {deal.event}</p>
                                    </div>
                                    <p className="text-sm font-bold tabular-nums text-emerald-500 shrink-0">
                                      £{Math.round(deal.amount).toLocaleString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Upcoming events — compact inline pills */}
                          {eventRecap.upcomingEvents.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Selling This Week · {eventRecap.upcomingEvents.length} events
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {eventRecap.upcomingEvents.map((event, i) => (
                                  <span
                                    key={i}
                                    className="text-[11px] px-2.5 py-1 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-foreground/80 inline-flex items-center gap-1.5"
                                    title={`${event.name}${event.revenueTarget ? ` — £${Math.round(event.closedWonGross || 0).toLocaleString()} / £${Math.round(event.revenueTarget).toLocaleString()}` : ""}`}
                                  >
                                    <span className="text-muted-foreground/50 tabular-nums">
                                      {new Date(event.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                    </span>
                                    <span className="font-medium truncate max-w-[180px]">{event.name}</span>
                                    {event.percentageToTarget !== null && event.percentageToTarget > 0 && (
                                      <span className={`text-[10px] font-bold tabular-nums ${
                                        event.percentageToTarget >= 100
                                          ? "text-emerald-500"
                                          : event.percentageToTarget >= 50
                                            ? "text-foreground/60"
                                            : "text-amber-500"
                                      }`}>
                                        {Math.round(event.percentageToTarget)}%
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Team Summary — prominent, the first thing everyone reads */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] border border-primary/15 p-6"
                    >
                      <p className="text-[15px] leading-relaxed text-foreground/90 font-medium">{digest.team_summary}</p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Event Demand — PROMOTED: core to the business, shown first */}
                      {digest.event_demand.length > 0 && (
                        <DigestSection title="Event Demand" icon={TrendUp} delay={0.08}>
                          <div className="space-y-2.5">
                            {digest.event_demand.map((event, i) => {
                              const sentLower = event.sentiment.toLowerCase();
                              // Parse sentiment: extract keyword + detail. Handles both "—" and " - "
                              const sentSplit = event.sentiment.split(/\s*[-—–]\s*/);
                              const sentKeyword = sentSplit[0]?.trim().toUpperCase() || "";
                              const sentDetail = sentSplit.slice(1).join(" — ").trim() || null;
                              // Colour by keyword
                              const tagStyle = sentLower.includes("hot") || sentLower.includes("high")
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                                : sentLower.includes("caution") || sentLower.includes("mixed")
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25"
                                  : sentLower.includes("critical") || sentLower.includes("cold")
                                    ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25"
                                    : sentLower.includes("warm")
                                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25"
                                      : "bg-foreground/[0.06] text-muted-foreground border-foreground/[0.08]";
                              const borderStyle = sentLower.includes("hot") || sentLower.includes("high")
                                ? "border-l-emerald-500"
                                : sentLower.includes("caution") || sentLower.includes("mixed")
                                  ? "border-l-amber-500"
                                  : sentLower.includes("critical") || sentLower.includes("cold")
                                    ? "border-l-red-500"
                                    : sentLower.includes("warm")
                                      ? "border-l-blue-500"
                                      : "border-l-foreground/20";
                              return (
                                <div key={i} className={`p-3 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] border-l-2 ${borderStyle}`}>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <p className="text-sm font-semibold truncate">{event.event}</p>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold shrink-0 ${tagStyle}`}>
                                        {sentKeyword}
                                      </span>
                                    </div>
                                    <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0">
                                      {event.mentions}x
                                    </span>
                                  </div>
                                  {sentDetail && (
                                    <p className="text-xs text-muted-foreground leading-relaxed">{sentDetail}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </DigestSection>
                      )}

                      {/* Follow-up Gaps — URGENT */}
                      {digest.follow_up_gaps.length > 0 && (
                        <DigestSection title="Follow-up Gaps" icon={Clock} delay={0.12}>
                          <div className="space-y-2">
                            {digest.follow_up_gaps.map((gap, i) => (
                              <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg border-l-2 border-l-red-500 bg-red-500/5 border border-red-500/10">
                                <Clock className="size-3.5 text-red-500 shrink-0 mt-0.5" weight="fill" />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-foreground">{gap.rep}</span>
                                  <p className="text-xs text-muted-foreground mt-0.5">{gap.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {/* Key Deals */}
                      {digest.key_deals.length > 0 && (
                        <DigestSection title="Key Deals" icon={Briefcase} delay={0.16}>
                          <div className="space-y-3">
                            {digest.key_deals.map((deal, i) => (
                              <div key={i} className="p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06]">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-semibold">{deal.contact}</p>
                                  <span className="text-xs text-muted-foreground font-medium">{deal.rep}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-1">{deal.status}</p>
                                <p className="text-xs text-foreground font-medium">→ {deal.next_steps}</p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {/* Objection Radar */}
                      {digest.top_objections.length > 0 && (
                        <DigestSection title="Objection Radar" icon={Warning} delay={0.2}>
                          <div className="space-y-4">
                            {digest.top_objections.map((obj, i) => (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-semibold">{obj.objection}</p>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 tabular-nums font-medium">
                                    {obj.frequency}x
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  → {obj.suggested_response}
                                </p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {/* What's Working */}
                      {digest.winning_pitches.length > 0 && (
                        <DigestSection title="What&apos;s Working" icon={Trophy} delay={0.24}>
                          <div className="space-y-3">
                            {digest.winning_pitches.map((pitch, i) => (
                              <div key={i} className="p-3 rounded-lg border-l-2 border-l-emerald-500 bg-emerald-500/5 border border-emerald-500/10">
                                <p className="text-sm">{pitch.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {pitch.rep} — {pitch.context}
                                </p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {/* Coaching Insights */}
                      {digest.coaching_highlights.length > 0 && (
                        <DigestSection title="Coaching Insights" icon={Lightning} delay={0.28}>
                          <div className="space-y-4">
                            {digest.coaching_highlights.filter(h => h.type === "strength").length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Trophy className="size-3" /> Strengths
                                </p>
                                <div className="space-y-2">
                                  {digest.coaching_highlights
                                    .filter(h => h.type === "strength")
                                    .map((highlight, i) => (
                                      <div key={i} className="p-3 rounded-lg border-l-2 border-emerald-500 bg-emerald-500/5 border border-emerald-500/10 border-l-emerald-500">
                                        <span className="text-xs font-bold">{highlight.rep}</span>
                                        <p className="text-xs text-muted-foreground mt-0.5">{highlight.description}</p>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                            {digest.coaching_highlights.filter(h => h.type === "improvement").length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <FontAwesomeIcon icon={faLightbulb} className="h-3 w-3" /> Areas to Improve
                                </p>
                                <div className="space-y-2">
                                  {digest.coaching_highlights
                                    .filter(h => h.type === "improvement")
                                    .map((highlight, i) => (
                                      <div key={i} className="p-3 rounded-lg border-l-2 border-amber-500 bg-amber-500/5 border border-amber-500/10 border-l-amber-500">
                                        <span className="text-xs font-bold">{highlight.rep}</span>
                                        <p className="text-xs text-muted-foreground mt-0.5">{highlight.description}</p>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </DigestSection>
                      )}

                      {/* Competitor Intel — only show if data exists */}
                      {digest.competitor_intelligence.length > 0 && (
                        <DigestSection title="Competitor Intel" icon={Target} delay={0.32}>
                          <div className="space-y-3">
                            {digest.competitor_intelligence.map((comp, i) => (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <p className="text-sm font-semibold">{comp.competitor}</p>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/[0.06] text-muted-foreground tabular-nums font-medium">
                                    {comp.mentions}x
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{comp.context}</p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <MagicWand className="size-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold mb-1">No digest generated yet</p>
                    <p className="text-sm mb-4">
                      Click Generate to create a digest of {periodLabel(period)} call activity and today&apos;s sales recap
                    </p>
                    <button
                      onClick={() => generateDigest()}
                      className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium shadow-lg"
                    >
                      Generate Digest
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════════════ TRANSCRIPT SEARCH TAB ═══════════════ */}
            {activeTab === "transcripts" && (
              <motion.div
                key="transcripts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold tracking-tight">Transcript Search</h2>
                      {transcriptCount !== null && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium tabular-nums">
                          {transcriptCount} stored
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Search across all call transcripts by keyword, objection, or phrase
                    </p>
                  </div>
                </motion.div>

                {/* Search Bar & Filters */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="rounded-2xl bg-card border border-border/50 p-5 space-y-4"
                >
                  {/* Main search row */}
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/50" />
                      <input
                        type="text"
                        value={transcriptQuery}
                        onChange={(e) => setTranscriptQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchTranscripts()}
                        placeholder='Search transcripts... e.g. "too expensive", "competitor", "budget"'
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-muted/50 border border-border/40 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                    </div>
                    <button
                      onClick={searchTranscripts}
                      disabled={transcriptLoading || !transcriptQuery.trim()}
                      className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 shadow-lg flex items-center gap-2 shrink-0"
                    >
                      {transcriptLoading ? (
                        <SpinnerGap className="size-4 animate-spin" />
                      ) : (
                        <MagnifyingGlass className="size-4" />
                      )}
                      Search
                    </button>
                  </div>

                  {/* Filter row */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Funnel className="size-3.5" />
                      <span className="font-medium">Filters:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarBlank className="size-3.5 text-muted-foreground/50" />
                      <input
                        type="date"
                        value={transcriptFromDate}
                        onChange={(e) => setTranscriptFromDate(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="From"
                      />
                      <span className="text-xs text-muted-foreground/40">→</span>
                      <input
                        type="date"
                        value={transcriptToDate}
                        onChange={(e) => setTranscriptToDate(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="To"
                      />
                    </div>
                    <select
                      value={transcriptDirection}
                      onChange={(e) => setTranscriptDirection(e.target.value as "" | "inbound" | "outbound")}
                      className="px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                    >
                      <option value="">All directions</option>
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </select>
                    {(transcriptFromDate || transcriptToDate || transcriptDirection) && (
                      <button
                        onClick={() => {
                          setTranscriptFromDate("");
                          setTranscriptToDate("");
                          setTranscriptDirection("");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </motion.div>

                {/* Results */}
                {transcriptLoading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16"
                  >
                    <MagnifyingGlass className="size-10 text-primary mx-auto mb-4 animate-pulse" />
                    <p className="text-base font-semibold mb-1">Searching transcripts...</p>
                    <p className="text-sm text-muted-foreground">
                      Scanning {transcriptCount || "all"} stored call transcripts
                    </p>
                  </motion.div>
                ) : hasSearched && transcriptResults.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <FileText className="size-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold mb-1">No matches found</p>
                    <p className="text-sm">
                      Try a different keyword or adjust your date filters
                    </p>
                  </motion.div>
                ) : transcriptResults.length > 0 ? (
                  <div className="space-y-3">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between px-1"
                    >
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{transcriptResults.length}</span>{" "}
                        {transcriptResults.length === 1 ? "call" : "calls"} matching &ldquo;
                        <span className="font-medium text-foreground">{transcriptQuery}</span>&rdquo;
                      </p>
                    </motion.div>

                    {transcriptResults.map((result, index) => (
                      <motion.button
                        key={result.callId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => analyseCallById(result.callId)}
                        className="w-full text-left rounded-2xl bg-card border border-border/50 hover:border-foreground/15 hover:bg-muted/30 transition-all overflow-hidden group"
                      >
                        <div className="p-4 pb-3 flex items-center gap-4">
                          <div className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-muted/40 text-muted-foreground">
                            {result.direction === "inbound" ? (
                              <PhoneIncoming className="size-5" />
                            ) : (
                              <PhoneOutgoing className="size-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate">{result.contactName}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium tabular-nums shrink-0">
                                {result.matchCount} {result.matchCount === 1 ? "match" : "matches"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate tabular-nums">
                              {result.agentName} · {formatDuration(result.duration)} ·{" "}
                              {new Date(result.startedAt * 1000).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}{" "}
                              {formatTime(result.startedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 opacity-0 group-hover:opacity-100 transition-opacity">
                              Analyse
                            </span>
                            <CaretRight className="size-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                          </div>
                        </div>

                        {/* Excerpt with keyword highlighting */}
                        <div className="px-4 pb-4">
                          <div className="text-xs leading-relaxed text-muted-foreground/80 bg-muted/30 rounded-lg px-3 py-2.5 border border-border/30 font-mono">
                            {highlightExcerpt(result.excerpt, transcriptQuery)}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <MagnifyingGlass className="size-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold mb-1">Search call transcripts</p>
                    <p className="text-sm max-w-md mx-auto mb-2">
                      Transcripts are auto-populated when you generate a digest or analyse individual calls. Search for keywords, objections, or phrases across all calls.
                    </p>
                    {transcriptCount !== null && transcriptCount > 0 && (
                      <p className="text-xs text-muted-foreground/60 mt-3">
                        {transcriptCount} transcripts available to search
                      </p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ═══════════════ DIAL PACE TAB ═══════════════ */}
            {activeTab === "dial-pace" && (
              <motion.div
                key="dial-pace"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {gapLoading && !gapData ? (
                  <div className="text-center py-16">
                    <SpinnerGap className="size-8 text-primary mx-auto mb-4 animate-spin" />
                    <p className="text-sm font-semibold">Loading dial pace data...</p>
                  </div>
                ) : !gapData || gapData.reps.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <Timer className="size-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold mb-1">No dial pace data yet</p>
                    <p className="text-sm max-w-md mx-auto">
                      Gap tracking starts when Aircall webhooks fire. Once reps start making calls, their pace data will appear here automatically.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* ═══ 3-Column Layout ═══ */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr_0.9fr] gap-4">

                      {/* Column 1: Pace Overview — metrics at top, donut at bottom */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="rounded-2xl bg-card border border-border/50 shadow-sm dark:shadow-none overflow-hidden flex flex-col"
                      >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                          <Gauge className="size-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold">Pace Overview</h3>
                        </div>

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 gap-px bg-border/30">
                          <div className="bg-card p-3.5">
                            <p className={`text-lg font-bold tabular-nums ${gapColorClass(gapData.team_avg_gap_seconds)}`}>
                              {formatGapShort(gapData.team_avg_gap_seconds)}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Team Avg</p>
                          </div>
                          <div className="bg-card p-3.5">
                            <p className="text-lg font-bold tabular-nums">{gapData.team_total_gaps}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Gaps</p>
                          </div>
                          <div className="bg-card p-3.5">
                            <p className="text-lg font-bold tabular-nums">{gapData.team_total_reps}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Reps Active</p>
                          </div>
                          <div className="bg-card p-3.5">
                            <p className={`text-lg font-bold tabular-nums ${gapData.reps.reduce((s, r) => s + r.gaps_over_5min, 0) > 0 ? "text-red-500" : ""}`}>
                              {gapData.reps.reduce((s, r) => s + r.gaps_over_5min, 0)}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Over 5min</p>
                          </div>
                        </div>

                        {/* Donut chart */}
                        <div className="flex-1 flex flex-col items-center justify-center p-5">
                          <PaceRingChart reps={gapData.reps} teamAvg={gapData.team_avg_gap_seconds} />
                        </div>

                        {/* Fastest / Avg / Slowest strip */}
                        <div className="grid grid-cols-3 gap-px bg-border/30 border-t border-border/30">
                          <div className="bg-card p-2.5 text-center">
                            <p className="text-xs font-bold tabular-nums text-emerald-500">
                              {formatGapShort(Math.min(...gapData.reps.filter(r => r.gap_count > 0).map(r => r.avg_gap_seconds), 0))}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Fastest</p>
                          </div>
                          <div className="bg-card p-2.5 text-center">
                            <p className={`text-xs font-bold tabular-nums ${gapColorClass(gapData.team_avg_gap_seconds)}`}>
                              {formatGapShort(gapData.team_avg_gap_seconds)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Team Avg</p>
                          </div>
                          <div className="bg-card p-2.5 text-center">
                            <p className="text-xs font-bold tabular-nums text-red-500">
                              {formatGapShort(Math.max(...gapData.reps.filter(r => r.gap_count > 0).map(r => r.avg_gap_seconds), 0))}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Slowest</p>
                          </div>
                        </div>
                      </motion.div>

                      {/* Column 2: Leaderboard with accordion drill-down */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="rounded-2xl bg-card border border-border/50 shadow-sm dark:shadow-none overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faTrophy} className="h-3.5 w-3.5 text-yellow-500" />
                            <h3 className="text-sm font-semibold">Pace Ranking</h3>
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">fastest first</span>
                        </div>
                        <div className="p-1.5 max-h-[540px] overflow-y-auto scrollbar-hide">
                          {gapData.reps.map((rep, i) => (
                            <GapRepRowAccordion
                              key={rep.aircall_user_id}
                              rep={rep}
                              index={i}
                              isExpanded={selectedGapRep === rep.aircall_user_id}
                              onToggle={() => {
                                if (selectedGapRep === rep.aircall_user_id) {
                                  setSelectedGapRep(null);
                                } else {
                                  fetchGapDetail(rep.aircall_user_id);
                                }
                              }}
                              gapDetail={selectedGapRep === rep.aircall_user_id ? gapDetail : null}
                              gapDetailLoading={selectedGapRep === rep.aircall_user_id && gapDetailLoading}
                            />
                          ))}
                        </div>
                      </motion.div>

                      {/* Column 3: Live Activity Feed */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-2xl bg-card border border-border/50 shadow-sm dark:shadow-none overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                          <Pulse className="size-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold">Live Status</h3>
                          <span className="relative flex size-1.5 ml-auto">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full size-1.5 bg-green-500" />
                          </span>
                        </div>
                        <div className="p-1.5 max-h-[540px] overflow-y-auto scrollbar-hide">
                          {(() => {
                            const sorted = [...gapData.reps]
                              .filter((r) => r.last_call_ended_at > 0)
                              .sort((a, b) => b.current_idle_seconds - a.current_idle_seconds);
                            return sorted.length > 0 ? (
                              sorted.map((rep) => (
                                <LiveRepStatus key={rep.aircall_user_id} rep={rep} />
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-8">No active reps</p>
                            );
                          })()}
                        </div>
                      </motion.div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
