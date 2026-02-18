"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Brain,
  Zap,
  AlertTriangle,
  Target,
  Trophy,
  MessageSquare,
  ChevronRight,
  Sparkles,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  BarChart3,
  Activity,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faCrown, faFire, faLightbulb, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import NumberFlow from "@number-flow/react";

// ── Types ──

type Tab = "overview" | "intelligence" | "digest";
type CallPeriod = "today" | "week" | "month";

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
  has_transcript: boolean;
}

interface HourlyData {
  [hour: number]: { inbound: number; outbound: number };
}

interface CallDataResponse {
  period: CallPeriod;
  stats: CallStats;
  repStats: RepCallStats[];
  recentCalls: RecentCall[];
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
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "intelligence", label: "Call Intelligence", icon: Brain },
  { key: "digest", label: "AI Digest", icon: Sparkles },
];

const PERIODS: { key: CallPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

const POLL_INTERVAL_MS = 60_000; // 1 minute

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

function sentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "positive":
      return "text-green-400";
    case "negative":
      return "text-red-400";
    case "mixed":
      return "text-yellow-400";
    default:
      return "text-muted-foreground";
  }
}

function sentimentBg(sentiment: string): string {
  switch (sentiment) {
    case "positive":
      return "bg-green-500/10 border-green-500/20";
    case "negative":
      return "bg-red-500/10 border-red-500/20";
    case "mixed":
      return "bg-yellow-500/10 border-yellow-500/20";
    default:
      return "bg-white/[0.04] border-white/[0.06]";
  }
}

function priorityBadge(priority: string): string {
  switch (priority) {
    case "high":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    case "medium":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    default:
      return "bg-white/[0.06] text-muted-foreground border-white/[0.08]";
  }
}

// ── Stat Card ──

function StatCard({
  label,
  value,
  icon: Icon,
  suffix,
  trend,
  color = "text-foreground",
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  suffix?: string;
  trend?: number;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {trend !== undefined && trend !== 0 && (
          <span
            className={`text-xs flex items-center gap-0.5 ${trend > 0 ? "text-green-400" : "text-red-400"}`}
          >
            {trend > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className={`text-3xl font-bold tracking-tight ${color}`}>
        <NumberFlow
          value={value}
          transformTiming={{ duration: 500, easing: "ease-out" }}
          spinTiming={{ duration: 400, easing: "ease-out" }}
        />
        {suffix && <span className="text-lg font-normal text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </motion.div>
  );
}

// ── Activity Bar Chart ──

function ActivityChart({ data }: { data: HourlyData }) {
  const hours = Object.keys(data)
    .map(Number)
    .sort((a, b) => a - b);
  const maxVal = Math.max(
    ...hours.map((h) => (data[h]?.inbound || 0) + (data[h]?.outbound || 0)),
    1
  );

  return (
    <div className="flex items-end gap-1.5 h-28 px-1">
      {hours.map((hour) => {
        const inbound = data[hour]?.inbound || 0;
        const outbound = data[hour]?.outbound || 0;
        const total = inbound + outbound;
        const pct = (total / maxVal) * 100;

        return (
          <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="w-full flex flex-col items-stretch">
              {/* Outbound bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(outbound / maxVal) * 80}px` }}
                transition={{ duration: 0.5, delay: hour * 0.03 }}
                className="bg-blue-500/60 rounded-t-sm min-h-0"
                style={{ minHeight: outbound > 0 ? 2 : 0 }}
              />
              {/* Inbound bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(inbound / maxVal) * 80}px` }}
                transition={{ duration: 0.5, delay: hour * 0.03 + 0.1 }}
                className="bg-emerald-500/60 rounded-t-sm min-h-0"
                style={{ minHeight: inbound > 0 ? 2 : 0 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground/50">{hour}</span>
            {/* Tooltip */}
            {total > 0 && (
              <div className="absolute bottom-full mb-2 px-2 py-1 bg-card border border-border rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                {outbound} out · {inbound} in
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
}: {
  rep: RepCallStats;
  index: number;
  maxCalls: number;
}) {
  const barWidth = maxCalls > 0 ? (rep.total_calls / maxCalls) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          index === 0
            ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900"
            : index === 1
              ? "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700"
              : index === 2
                ? "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100"
                : "bg-muted/60 text-muted-foreground"
        }`}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold truncate">{rep.name}</p>
          <span className="text-sm font-bold tabular-nums">{rep.total_calls}</span>
        </div>
        <div className="w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.6, delay: index * 0.04 }}
            className={`h-full rounded-full ${
              index === 0
                ? "bg-yellow-500/70"
                : index === 1
                  ? "bg-gray-400/70"
                  : index === 2
                    ? "bg-amber-500/70"
                    : "bg-white/20"
            }`}
          />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground/60">
            {rep.outbound_calls} out · {rep.inbound_calls} in
          </span>
          <span className="text-xs text-muted-foreground/40">
            {formatDurationShort(Math.round(rep.avg_duration))} avg
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Call Feed Row ──

function CallRow({ call, onClick }: { call: RecentCall; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors text-left group"
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          call.direction === "inbound"
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-blue-500/10 text-blue-400"
        }`}
      >
        {call.direction === "inbound" ? (
          <PhoneIncoming className="h-4 w-4" />
        ) : (
          <PhoneOutgoing className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{call.contact_name}</p>
          {call.has_transcript && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              AI
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/60 truncate">
          {call.agent_name} · {formatDuration(call.duration)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground/50">{timeAgo(call.started_at)}</p>
      </div>
    </motion.button>
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
      className="fixed inset-y-0 right-0 w-full max-w-xl z-50 bg-background/98 backdrop-blur-xl border-l border-white/[0.08] overflow-y-auto"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold">Call Analysis</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border capitalize ${sentimentBg(analysis.sentiment)}`}
            >
              {analysis.sentiment} · {analysis.sentiment_score}/100
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
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
                  className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08]"
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
            <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Objections Detected
            </h3>
            <div className="space-y-2">
              {analysis.objections.map((obj, i) => (
                <div key={i} className="text-sm p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  {obj}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {analysis.action_items.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> Action Items
            </h3>
            <div className="space-y-2">
              {analysis.action_items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-sm p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 uppercase font-bold ${priorityBadge(item.priority)}`}
                  >
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
            <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" /> Opportunities
            </h3>
            <div className="space-y-2">
              {analysis.opportunity_signals.map((opp, i) => (
                <div
                  key={i}
                  className="text-sm p-3 rounded-lg bg-green-500/5 border border-green-500/10"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 uppercase font-bold">
                      {opp.type.replace("_", " ")}
                    </span>
                    {opp.estimated_value && (
                      <span className="text-xs text-green-400 font-semibold">{opp.estimated_value}</span>
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
                  className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20"
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
          <div className="flex items-center gap-2 h-3 rounded-full overflow-hidden">
            <div
              className="bg-blue-500/60 h-full rounded-l-full transition-all"
              style={{ width: `${analysis.talk_to_listen_ratio.agent_pct}%` }}
            />
            <div
              className="bg-emerald-500/60 h-full rounded-r-full transition-all"
              style={{ width: `${analysis.talk_to_listen_ratio.contact_pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-blue-400">
              Agent {analysis.talk_to_listen_ratio.agent_pct}%
            </span>
            <span className="text-xs text-emerald-400">
              Contact {analysis.talk_to_listen_ratio.contact_pct}%
            </span>
          </div>
        </div>

        {/* Coaching Notes */}
        {analysis.coaching_notes && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faLightbulb} className="h-3.5 w-3.5" /> Coaching
            </h3>
            <p className="text-sm p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
              {analysis.coaching_notes}
            </p>
          </div>
        )}

        {/* Draft Follow-up */}
        {analysis.draft_follow_up && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" /> Suggested Follow-up
            </h3>
            <div className="text-sm p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] whitespace-pre-line italic">
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
  iconColor,
  children,
  delay = 0,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
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

  // ── Auto-fetch digest when switching to that tab ──

  useEffect(() => {
    if (activeTab === "digest" && !digest && !digestLoading) {
      generateDigest();
    }
  }, [activeTab]);

  // ── Derived values ──
  const stats = callData?.stats;
  const repStats = callData?.repStats || [];
  const recentCalls = callData?.recentCalls || [];
  const hourlyData = callData?.hourlyDistribution || {};
  const maxRepCalls = repStats.length > 0 ? repStats[0].total_calls : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      {/* Analysis slide-over panel */}
      <AnimatePresence>
        {selectedCallId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
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
                className="fixed inset-y-0 right-0 w-full max-w-xl z-50 bg-background/98 backdrop-blur-xl border-l border-white/[0.08] flex items-center justify-center"
              >
                <div className="text-center">
                  <Brain className="h-10 w-10 text-purple-400 mx-auto mb-4 animate-pulse" />
                  <p className="text-lg font-semibold mb-1">Analysing Call</p>
                  <p className="text-sm text-muted-foreground">
                    Reading transcript & generating insights...
                  </p>
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

      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 lg:p-8 pl-24">
        <div className="max-w-7xl mx-auto">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Call Intelligence</h1>
                <p className="text-sm text-muted-foreground">
                  Powered by Aircall + AI
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
              {lastUpdated && (
                <span className="text-xs text-muted-foreground/50">
                  {lastUpdated.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              <button
                onClick={() => fetchCallData(true)}
                disabled={isRefreshing}
                className="p-2 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-all"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </motion.div>

          {/* ── Tab Bar + Period Selector ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between mb-6"
          >
            {/* Tabs */}
            <div className="flex bg-white/[0.04] rounded-xl p-1 border border-white/[0.06]">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-white/[0.1] text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Period selector */}
            <div className="flex bg-white/[0.04] rounded-lg p-1 border border-white/[0.06]">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    period === p.key
                      ? "bg-white/[0.1] text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── Error ── */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
            >
              {error}
              <button
                onClick={() => fetchCallData()}
                className="ml-2 underline hover:text-red-200"
              >
                Try again
              </button>
            </motion.div>
          )}

          {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  label="Total Calls"
                  value={stats?.total_calls || 0}
                  icon={Phone}
                  color="text-foreground"
                  delay={0}
                />
                <StatCard
                  label="Outbound"
                  value={stats?.outbound_calls || 0}
                  icon={PhoneOutgoing}
                  color="text-blue-400"
                  delay={0.05}
                />
                <StatCard
                  label="Inbound"
                  value={stats?.inbound_calls || 0}
                  icon={PhoneIncoming}
                  color="text-emerald-400"
                  delay={0.1}
                />
                <StatCard
                  label="Avg Duration"
                  value={Math.round(stats?.avg_duration || 0)}
                  icon={Clock}
                  suffix="s"
                  color="text-amber-400"
                  delay={0.15}
                />
                <StatCard
                  label="Meaningful (2m+)"
                  value={callData?.meaningfulCallCount || 0}
                  icon={Brain}
                  color="text-purple-400"
                  delay={0.2}
                />
              </div>

              {/* Main content grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Call Activity Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="lg:col-span-2 rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4.5 w-4.5 text-blue-400" />
                      <h2 className="text-base font-semibold">Call Activity</h2>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm bg-blue-500/60" />
                        Outbound
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm bg-emerald-500/60" />
                        Inbound
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    {initialLoading ? (
                      <div className="h-28 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <ActivityChart data={hourlyData} />
                    )}
                  </div>
                </motion.div>

                {/* Talk Time Summary */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <Clock className="h-4.5 w-4.5 text-amber-400" />
                    <h2 className="text-base font-semibold">Talk Time</h2>
                  </div>

                  {initialLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse bg-muted/30 h-12 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Talk Time</span>
                        <span className="text-lg font-bold">
                          {formatDuration(stats?.total_talk_time || 0)}
                        </span>
                      </div>
                      <div className="h-px bg-white/[0.06]" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Avg per Call</span>
                        <span className="text-lg font-bold">
                          {formatDuration(Math.round(stats?.avg_talk_time || 0))}
                        </span>
                      </div>
                      <div className="h-px bg-white/[0.06]" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Answered</span>
                        <span className="text-lg font-bold text-emerald-400">
                          {stats?.answered_calls || 0}
                        </span>
                      </div>
                      <div className="h-px bg-white/[0.06]" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Missed</span>
                        <span className="text-lg font-bold text-red-400">
                          {stats?.missed_calls || 0}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Rep Stats + Recent Calls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rep Leaderboard */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                    <Users className="h-4.5 w-4.5 text-yellow-500" />
                    <h2 className="text-base font-semibold">Calls by Rep</h2>
                  </div>
                  <div className="p-3 max-h-[420px] overflow-y-auto scrollbar-hide">
                    {initialLoading ? (
                      <div className="space-y-3 p-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                            <div className="animate-pulse bg-muted h-8 w-8 rounded-full" />
                            <div className="flex-1">
                              <div className="animate-pulse bg-muted h-3 w-24 rounded mb-2" />
                              <div className="animate-pulse bg-muted h-1.5 w-full rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : repStats.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
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

                {/* Recent Calls Feed */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4.5 w-4.5 text-blue-400" />
                      <h2 className="text-base font-semibold">Recent Calls</h2>
                    </div>
                    <span className="text-xs text-muted-foreground/50">
                      Click to AI analyse
                    </span>
                  </div>
                  <div className="p-2 max-h-[420px] overflow-y-auto scrollbar-hide">
                    {initialLoading ? (
                      <div className="space-y-2 p-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                            <div className="animate-pulse bg-muted h-9 w-9 rounded-full" />
                            <div className="flex-1">
                              <div className="animate-pulse bg-muted h-3 w-28 rounded mb-2" />
                              <div className="animate-pulse bg-muted h-2.5 w-20 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recentCalls.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Phone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No calls yet</p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {recentCalls.map((call) => (
                          <CallRow
                            key={call.id}
                            call={call}
                            onClick={() => {
                              if (call.has_transcript) {
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
            </div>
          )}

          {/* ═══════════════ INTELLIGENCE TAB ═══════════════ */}
          {activeTab === "intelligence" && (
            <div className="space-y-6">
              {/* Meaningful calls header */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Brain className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">AI Call Analysis</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Click any call with 2+ minutes to get instant AI-powered insights,
                      objection detection, action items, and coaching feedback.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-bold text-lg">
                      {callData?.meaningfulCallCount || 0}
                    </span>
                    <span className="text-muted-foreground">analysable calls</span>
                  </div>
                  <div className="h-4 w-px bg-white/[0.1]" />
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Powered by Claude Sonnet
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Call list for analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {recentCalls
                  .filter((c) => c.has_transcript)
                  .map((call, index) => (
                    <motion.button
                      key={call.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => analyseCallById(call.id)}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-purple-500/20 transition-all text-left group"
                    >
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          call.direction === "inbound"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {call.direction === "inbound" ? (
                          <PhoneIncoming className="h-5 w-5" />
                        ) : (
                          <PhoneOutgoing className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{call.contact_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {call.agent_name} · {formatDuration(call.duration)} · {formatTime(call.started_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                          Analyse
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-purple-400 transition-colors" />
                      </div>
                    </motion.button>
                  ))}
              </div>

              {recentCalls.filter((c) => c.has_transcript).length === 0 && !initialLoading && (
                <div className="text-center py-16 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold mb-1">No analysable calls yet</p>
                  <p className="text-sm">
                    Calls longer than 2 minutes will appear here for AI analysis
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ AI DIGEST TAB ═══════════════ */}
          {activeTab === "digest" && (
            <div className="space-y-6">
              {/* Digest header */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">AI Sales Digest</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {digest
                          ? `${digest.total_calls_analysed} calls analysed · Generated ${new Date(digest.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                          : "AI analyses all meaningful calls and generates team-wide insights"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => generateDigest(true)}
                    disabled={digestLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {digestLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {digestLoading ? "Generating..." : "Refresh"}
                  </button>
                </div>
              </motion.div>

              {digestLoading && !digest ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <Sparkles className="h-12 w-12 text-amber-400 mx-auto mb-4 animate-pulse" />
                  <p className="text-lg font-semibold mb-2">Generating AI Digest</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Analysing call transcripts, detecting patterns, and generating team-wide insights. This may take 30-60 seconds...
                  </p>
                </motion.div>
              ) : digest ? (
                <div className="space-y-6">
                  {/* Team Summary */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-6"
                  >
                    <p className="text-base leading-relaxed">{digest.team_summary}</p>
                  </motion.div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Objection Radar */}
                    {digest.top_objections.length > 0 && (
                      <DigestSection
                        title="Objection Radar"
                        icon={AlertTriangle}
                        iconColor="text-red-400"
                        delay={0.1}
                      >
                        <div className="space-y-4">
                          {digest.top_objections.map((obj, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold">{obj.objection}</p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
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

                    {/* Winning Pitches */}
                    {digest.winning_pitches.length > 0 && (
                      <DigestSection
                        title="What's Working"
                        icon={Trophy}
                        iconColor="text-green-400"
                        delay={0.15}
                      >
                        <div className="space-y-3">
                          {digest.winning_pitches.map((pitch, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-lg bg-green-500/5 border border-green-500/10"
                            >
                              <p className="text-sm">{pitch.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {pitch.rep} — {pitch.context}
                              </p>
                            </div>
                          ))}
                        </div>
                      </DigestSection>
                    )}

                    {/* Event Demand */}
                    {digest.event_demand.length > 0 && (
                      <DigestSection
                        title="Event Demand"
                        icon={TrendingUp}
                        iconColor="text-amber-400"
                        delay={0.2}
                      >
                        <div className="space-y-3">
                          {digest.event_demand.map((event, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">{event.event}</p>
                                <p className="text-xs text-muted-foreground">{event.sentiment}</p>
                              </div>
                              <span className="text-sm font-bold text-amber-400">
                                {event.mentions} mentions
                              </span>
                            </div>
                          ))}
                        </div>
                      </DigestSection>
                    )}

                    {/* Competitor Intelligence */}
                    {digest.competitor_intelligence.length > 0 && (
                      <DigestSection
                        title="Competitor Intel"
                        icon={Target}
                        iconColor="text-orange-400"
                        delay={0.25}
                      >
                        <div className="space-y-3">
                          {digest.competitor_intelligence.map((comp, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-0.5">
                                <p className="text-sm font-semibold">{comp.competitor}</p>
                                <span className="text-xs text-muted-foreground">
                                  {comp.mentions}x mentioned
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{comp.context}</p>
                            </div>
                          ))}
                        </div>
                      </DigestSection>
                    )}

                    {/* Coaching Highlights */}
                    {digest.coaching_highlights.length > 0 && (
                      <DigestSection
                        title="Coaching Insights"
                        icon={Zap}
                        iconColor="text-yellow-400"
                        delay={0.3}
                      >
                        <div className="space-y-3">
                          {digest.coaching_highlights.map((highlight, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg border ${
                                highlight.type === "strength"
                                  ? "bg-green-500/5 border-green-500/10"
                                  : "bg-yellow-500/5 border-yellow-500/10"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold uppercase">
                                  {highlight.rep}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${
                                    highlight.type === "strength"
                                      ? "bg-green-500/20 text-green-300 border-green-500/30"
                                      : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                                  }`}
                                >
                                  {highlight.type}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {highlight.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </DigestSection>
                    )}

                    {/* Key Deals */}
                    {digest.key_deals.length > 0 && (
                      <DigestSection
                        title="Key Deals"
                        icon={Target}
                        iconColor="text-blue-400"
                        delay={0.35}
                      >
                        <div className="space-y-3">
                          {digest.key_deals.map((deal, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold">{deal.contact}</p>
                                <span className="text-xs text-muted-foreground">{deal.rep}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Status: {deal.status}
                              </p>
                              <p className="text-xs text-blue-400">→ {deal.next_steps}</p>
                            </div>
                          ))}
                        </div>
                      </DigestSection>
                    )}

                    {/* Follow-up Gaps */}
                    {digest.follow_up_gaps.length > 0 && (
                      <DigestSection
                        title="Follow-up Gaps"
                        icon={AlertTriangle}
                        iconColor="text-orange-400"
                        delay={0.4}
                      >
                        <div className="space-y-2">
                          {digest.follow_up_gaps.map((gap, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 text-sm p-3 rounded-lg bg-orange-500/5 border border-orange-500/10"
                            >
                              <span className="text-xs font-bold text-orange-400 shrink-0">
                                {gap.rep}
                              </span>
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
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold mb-1">No digest generated yet</p>
                  <p className="text-sm mb-4">
                    Click Refresh to generate an AI digest of today&apos;s calls
                  </p>
                  <button
                    onClick={() => generateDigest()}
                    className="px-6 py-3 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors text-sm font-medium"
                  >
                    Generate Digest
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
