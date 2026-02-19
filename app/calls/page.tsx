"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
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
} from "@phosphor-icons/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLightbulb, faTrophy } from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import NumberFlow from "@number-flow/react";

// ── Types ──

type Tab = "overview" | "intelligence" | "digest";
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
  events_mentioned: string[];
  talk_to_listen_ratio: { agent_pct: number; contact_pct: number };
  coaching_notes: string | null;
  draft_follow_up: string | null;
  analysed_at: string;
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
];

const PERIODS: { key: CallPeriod; label: string; shortLabel: string }[] = [
  { key: "today", label: "Today", shortLabel: "today" },
  { key: "week", label: "This Week", shortLabel: "this week" },
  { key: "month", label: "This Month", shortLabel: "this month" },
];

const POLL_INTERVAL_MS = 60_000;

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

// ── Activity Bar Chart (full-width, taller) ──

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
        const barH = 160; // max bar height in px

        return (
          <div key={hour} className="flex-1 flex flex-col items-center gap-1.5 group relative">
            <div className="w-full flex flex-col items-stretch">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(outbound / maxVal) * barH}px` }}
                transition={{ duration: 0.6, delay: hour * 0.025, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="bg-foreground/25 rounded-t-sm min-h-0"
                style={{ minHeight: outbound > 0 ? 2 : 0 }}
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(inbound / maxVal) * barH}px` }}
                transition={{ duration: 0.6, delay: hour * 0.025 + 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="bg-foreground/10 rounded-b-sm min-h-0"
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
  onClose,
}: {
  analysis: CallAnalysis;
  onClose: () => void;
}) {
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
            <span className="text-xs px-2 py-0.5 rounded-full border capitalize bg-foreground/[0.06] border-foreground/[0.08]">
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
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {topic}
                </span>
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
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Target className="size-3.5 text-muted-foreground" /> Action Items
            </h3>
            <div className="space-y-2">
              {analysis.action_items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-sm p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06]"
                >
                  <span className="text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 uppercase font-bold bg-foreground/[0.06] text-muted-foreground border-foreground/[0.08]">
                    {item.priority}
                  </span>
                  <div>
                    <p>{item.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">→ {item.assignee}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunity Signals */}
        {analysis.opportunity_signals.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <TrendUp className="size-3.5 text-muted-foreground" /> Opportunities
            </h3>
            <div className="space-y-2">
              {analysis.opportunity_signals.map((opp, i) => (
                <div
                  key={i}
                  className="text-sm p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.06] text-muted-foreground border border-foreground/[0.08] uppercase font-bold">
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
            <div className="flex flex-wrap gap-2">
              {analysis.events_mentioned.map((event, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-foreground/[0.06] border border-foreground/[0.08]"
                >
                  {event}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Talk-to-Listen Ratio */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Talk-to-Listen Ratio</h3>
          <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden">
            <div
              className="bg-foreground/30 h-full rounded-l-full"
              style={{ width: `${analysis.talk_to_listen_ratio.agent_pct}%` }}
            />
            <div
              className="bg-foreground/10 h-full rounded-r-full"
              style={{ width: `${analysis.talk_to_listen_ratio.contact_pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground tabular-nums">
              Agent {analysis.talk_to_listen_ratio.agent_pct}%
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              Contact {analysis.talk_to_listen_ratio.contact_pct}%
            </span>
          </div>
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
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <ChatText className="size-3.5" /> Suggested Follow-up
            </h3>
            <div className="text-sm p-4 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06] whitespace-pre-line italic">
              {analysis.draft_follow_up}
            </div>
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

// ── Metric Card ──

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenView, setFullscreenView] = useState<FullscreenView>(null);

  // Intelligence tab state
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [callAnalysis, setCallAnalysis] = useState<CallAnalysis | null>(null);

  // Digest tab state
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);

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
        setIsRefreshing(false);
      }
    },
    [period]
  );

  useEffect(() => {
    if (user) fetchCallData(hasFetchedOnce.current);
  }, [user, fetchCallData]);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(() => fetchCallData(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, fetchCallData]);

  // ── Analyse a single call ──

  const analyseCallById = async (callId: number) => {
    setSelectedCallId(callId);
    setAnalysisLoading(true);
    setCallAnalysis(null);

    try {
      const response = await fetch("/api/calls/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: callId }),
      });
      const result = await response.json();
      if (result.success) {
        setCallAnalysis(result.data);
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

    try {
      const response = await fetch("/api/calls/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, force_refresh: forceRefresh }),
      });
      const result = await response.json();
      if (result.success) {
        setDigest(result.data);
      } else {
        console.error("Digest generation failed:", result.error);
      }
    } catch (err) {
      console.error("Error generating digest:", err);
    } finally {
      setDigestLoading(false);
    }
  };

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
    <DashboardLayout>
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
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
              onClick={() => {
                setSelectedCallId(null);
                setCallAnalysis(null);
              }}
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
                    Downloading recording → Transcribing with Whisper → Analysing with Claude...
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-2">This may take 15-30 seconds</p>
                </div>
              </motion.div>
            ) : callAnalysis ? (
              <AnalysisPanel
                analysis={callAnalysis}
                onClose={() => {
                  setSelectedCallId(null);
                  setCallAnalysis(null);
                }}
              />
            ) : null}
          </>
        )}
      </AnimatePresence>

      <div className="min-h-dvh bg-gradient-to-br from-background to-muted/20 p-6 lg:p-8 pl-24">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* ═══ Section 1: Command Bar Header ═══ */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl px-6 py-4 flex items-center justify-between gap-4"
          >
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <Phone className="size-6 text-foreground" weight="bold" />
              <h1 className="text-2xl font-bold tracking-tight">Calls</h1>
            </div>

            {/* Center: Period Selector (inline segmented) */}
            <div className="bg-muted/50 rounded-lg p-1 flex relative">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`relative z-10 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    period === p.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Right: Live indicator + refresh */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-green-500" />
                </span>
                <span className="text-xs text-muted-foreground font-medium">Live</span>
              </div>
              {lastUpdated && (
                <span className="text-xs text-muted-foreground/50 tabular-nums">
                  {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={() => fetchCallData(true)}
                disabled={isRefreshing}
                className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Refresh data"
              >
                <ArrowsClockwise className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </motion.div>

          {/* ═══ Tab Bar ═══ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex"
          >
            <div className="flex bg-muted/30 rounded-lg p-1 border border-border/30">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="size-4" weight={activeTab === tab.key ? "fill" : "regular"} />
                  {tab.label}
                </button>
              ))}
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
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
                        <span className="size-2.5 rounded-sm bg-foreground/25" />
                        Outbound
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-foreground/10" />
                        Inbound
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    {initialLoading ? (
                      <div className="h-44 flex items-end gap-1 px-1">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                            <div
                              className="w-full animate-pulse bg-muted/30 rounded-t-sm"
                              style={{ height: `${30 + Math.random() * 100}px` }}
                            />
                            <div className="animate-pulse bg-muted/20 h-2 w-4 rounded" />
                          </div>
                        ))}
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
                      Click any call to transcribe and analyse with Whisper + Claude
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
                        : "Analyse all meaningful calls and generate team-wide insights"}
                    </p>
                  </div>
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
                </motion.div>

                {digestLoading && !digest ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20"
                  >
                    <MagicWand className="size-12 text-primary mx-auto mb-4 animate-pulse" />
                    <p className="text-lg font-semibold mb-2">Generating AI Digest</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Analysing call transcripts, detecting patterns, and generating team-wide insights. This may take 30-60 seconds...
                    </p>
                  </motion.div>
                ) : digest ? (
                  <div className="space-y-5">
                    {/* Team Summary */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl bg-card border border-border/50 p-6"
                    >
                      <p className="text-base leading-relaxed italic text-foreground/80">{digest.team_summary}</p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {digest.top_objections.length > 0 && (
                        <DigestSection title="Objection Radar" icon={Warning} delay={0.1}>
                          <div className="space-y-4">
                            {digest.top_objections.map((obj, i) => (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-semibold">{obj.objection}</p>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/[0.06] text-muted-foreground tabular-nums">
                                    {obj.frequency}x
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  💡 {obj.suggested_response}
                                </p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {digest.winning_pitches.length > 0 && (
                        <DigestSection title="What&apos;s Working" icon={Trophy} delay={0.15}>
                          <div className="space-y-3">
                            {digest.winning_pitches.map((pitch, i) => (
                              <div key={i} className="p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06]">
                                <p className="text-sm">{pitch.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {pitch.rep} — {pitch.context}
                                </p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {digest.event_demand.length > 0 && (
                        <DigestSection title="Event Demand" icon={TrendUp} delay={0.2}>
                          <div className="space-y-3">
                            {digest.event_demand.map((event, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold">{event.event}</p>
                                  <p className="text-xs text-muted-foreground">{event.sentiment}</p>
                                </div>
                                <span className="text-sm font-bold text-foreground tabular-nums">
                                  {event.mentions} mentions
                                </span>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {digest.competitor_intelligence.length > 0 && (
                        <DigestSection title="Competitor Intel" icon={Target} delay={0.25}>
                          <div className="space-y-3">
                            {digest.competitor_intelligence.map((comp, i) => (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <p className="text-sm font-semibold">{comp.competitor}</p>
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {comp.mentions}x mentioned
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{comp.context}</p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {digest.coaching_highlights.length > 0 && (
                        <DigestSection title="Coaching Insights" icon={Lightning} delay={0.3}>
                          <div className="space-y-3">
                            {digest.coaching_highlights.map((highlight, i) => (
                              <div key={i} className="p-3 rounded-lg border bg-foreground/[0.02] border-foreground/[0.06]">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold uppercase">{highlight.rep}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border uppercase bg-foreground/[0.06] text-muted-foreground border-foreground/[0.08]">
                                    {highlight.type}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{highlight.description}</p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {digest.key_deals.length > 0 && (
                        <DigestSection title="Key Deals" icon={Target} delay={0.35}>
                          <div className="space-y-3">
                            {digest.key_deals.map((deal, i) => (
                              <div key={i} className="p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06]">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-semibold">{deal.contact}</p>
                                  <span className="text-xs text-muted-foreground">{deal.rep}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-1">Status: {deal.status}</p>
                                <p className="text-xs text-foreground">→ {deal.next_steps}</p>
                              </div>
                            ))}
                          </div>
                        </DigestSection>
                      )}

                      {digest.follow_up_gaps.length > 0 && (
                        <DigestSection title="Follow-up Gaps" icon={Warning} delay={0.4}>
                          <div className="space-y-2">
                            {digest.follow_up_gaps.map((gap, i) => (
                              <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06]">
                                <span className="text-xs font-bold text-foreground shrink-0">{gap.rep}</span>
                                <p className="text-xs text-muted-foreground">{gap.description}</p>
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
                      Click Generate to create an AI digest of {periodLabel(period)}&apos;s calls
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
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
