"use client";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Warning,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  X,
  Spinner,
  ChartBar,
  EnvelopeSimple,
  CopySimple,
  CurrencyGbp,
  CaretDown,
  CaretRight,
  ChatText,
  PaperPlaneTilt,
  Check,
  Tag,
  ArrowsClockwise,
  Funnel,
} from "@phosphor-icons/react";
import type {
  EnrichedInvoice,
  ChaseStageKey,
  ChaseStageConfig,
  ChaseActivity,
  XeroBankAccount,
} from "@/lib/types";

// ── Severity Tiers ──

const SEVERITY_TIERS = [
  { min: 1, max: 30, key: "warning", label: "1-30d", borderColor: "border-l-amber-500", badgeBg: "bg-amber-100 dark:bg-amber-500/15", badgeText: "text-amber-700 dark:text-amber-400", rowTint: "bg-amber-50/50 dark:bg-amber-500/[0.03]", barColor: "bg-amber-500" },
  { min: 31, max: 90, key: "escalation", label: "31-90d", borderColor: "border-l-orange-500", badgeBg: "bg-orange-100 dark:bg-orange-500/15", badgeText: "text-orange-700 dark:text-orange-400", rowTint: "bg-orange-50/50 dark:bg-orange-500/[0.04]", barColor: "bg-orange-500" },
  { min: 91, max: 365, key: "critical", label: "91d-1yr", borderColor: "border-l-red-500", badgeBg: "bg-red-100 dark:bg-red-500/15", badgeText: "text-red-700 dark:text-red-400", rowTint: "bg-red-50/50 dark:bg-red-500/[0.05]", barColor: "bg-red-500" },
  { min: 366, max: Infinity, key: "writeoff", label: "1yr+", borderColor: "border-l-red-800 dark:border-l-red-900", badgeBg: "bg-red-200 dark:bg-red-900/25", badgeText: "text-red-900 dark:text-red-300", rowTint: "bg-red-100/50 dark:bg-red-900/[0.06]", barColor: "bg-red-800" },
] as const;

function getSeverityTier(daysOverdue: number) {
  return SEVERITY_TIERS.find(t => daysOverdue >= t.min && daysOverdue <= t.max) || SEVERITY_TIERS[3];
}

// ── Chase Stage Config ──

const CHASE_STAGES: ChaseStageConfig[] = [
  { key: "1-3_days_xero_reminder", label: "1-3 days Xero Reminder", color: "bg-green-100 dark:bg-green-500/15", textColor: "text-green-700 dark:text-green-400", description: "Automated Xero reminder sent" },
  { key: "3-5_days_finance_email", label: "3-5 days Finance Email", color: "bg-blue-100 dark:bg-blue-500/15", textColor: "text-blue-700 dark:text-blue-400", description: "Finance team sends manual email" },
  { key: "8_days_process_email", label: "8 days Process + Email", color: "bg-orange-100 dark:bg-orange-500/15", textColor: "text-orange-700 dark:text-orange-400", description: "Attempt to take payment + email" },
  { key: "10_days_process_email", label: "10 days Process + Email", color: "bg-purple-100 dark:bg-purple-500/15", textColor: "text-purple-700 dark:text-purple-400", description: "Second attempt to process + email" },
  { key: "daily_chaser", label: "Daily Chaser", color: "bg-amber-100 dark:bg-amber-500/15", textColor: "text-amber-700 dark:text-amber-400", description: "Daily follow-up" },
  { key: "final_warning", label: "Final Warning", color: "bg-red-100 dark:bg-red-500/15", textColor: "text-red-700 dark:text-red-400", description: "Last warning before cancellation" },
  { key: "cancellation_terms", label: "Cancellation Terms", color: "bg-red-200 dark:bg-red-500/20", textColor: "text-red-800 dark:text-red-300", description: "Cancellation terms issued" },
  { key: "bolt_on", label: "BOLT ON", color: "bg-emerald-100 dark:bg-emerald-500/15", textColor: "text-emerald-700 dark:text-emerald-400", description: "Bolt-on / resolved" },
];

const getStageConfig = (key: string): ChaseStageConfig | undefined =>
  CHASE_STAGES.find((s) => s.key === key);

// ── Helpers ──

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "£0";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatCurrencyPrecise(amount: number | null | undefined): string {
  if (amount == null) return "£0.00";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return ts; }
}

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "Never chased";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getLastChasedTime(inv: EnrichedInvoice): string | undefined {
  return inv.lastActivity?.timestamp || inv.chaseStage?.updatedAt;
}

type TabKey = "overdue" | "overview";
type AmountFilter = "all" | "1k" | "5k" | "10k";

interface OverviewData {
  totalOverdue: number;
  totalOutstanding: number;
  invoiceCount: number;
  stageBreakdown: Record<string, { count: number; total: number }>;
  agingBuckets: { label: string; count: number; total: number }[];
}

// ── Main Component ──

export default function FinancePage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [bankAccounts, setBankAccounts] = useState<XeroBankAccount[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>("overdue");
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [amountFilter, setAmountFilter] = useState<AmountFilter>("all");
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const hasFetchedOnce = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Action states
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [changingStage, setChangingStage] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentBankId, setPaymentBankId] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; msg: string } | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState<string | null>(null);

  const [activities, setActivities] = useState<ChaseActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // ── Data Fetching ──

  const fetchInvoices = useCallback(async (silent = false, forceRefresh = false) => {
    if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
    if (silent) setIsRefreshing(true);
    setError(null);
    try {
      const url = forceRefresh ? "/api/xero/invoices?refresh=true" : "/api/xero/invoices";
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch invoices");
      }
      const json = await res.json();
      if (json.success) { setInvoices(json.data || []); hasFetchedOnce.current = true; }
      else throw new Error(json.error || "Unknown error");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load finance data";
      setError(message);
    } finally { setInitialLoading(false); setIsRefreshing(false); }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/xero/overview");
      if (res.ok) { const json = await res.json(); if (json.success) setOverview(json.data); }
    } catch {}
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/xero/bank-accounts");
      if (res.ok) { const json = await res.json(); if (json.success) setBankAccounts(json.data || []); }
    } catch {}
  }, []);

  const fetchInvoiceDetails = useCallback(async (invoiceId: string) => {
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/xero/invoices/${invoiceId}`);
      if (res.ok) { const json = await res.json(); if (json.success) setActivities(json.data.activities || []); }
    } catch {} finally { setLoadingActivities(false); }
  }, []);

  useEffect(() => {
    if (user) { fetchInvoices(hasFetchedOnce.current); fetchOverview(); fetchBankAccounts(); }
  }, [user, fetchInvoices, fetchOverview, fetchBankAccounts]);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(() => { fetchInvoices(true); fetchOverview(); }, 120_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, fetchInvoices, fetchOverview]);

  useEffect(() => { if (expandedInvoice) fetchInvoiceDetails(expandedInvoice); }, [expandedInvoice, fetchInvoiceDetails]);

  // ── Actions ──

  const copyEmail = (email: string, invoiceId: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(invoiceId);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleSendEmail = async (invoiceId: string) => {
    setSendingEmail(invoiceId);
    try {
      const res = await fetch(`/api/xero/invoices/${invoiceId}/email`, { method: "POST" });
      if (!res.ok) throw new Error();
      showFeedback(invoiceId, "Reminder sent!");
      if (expandedInvoice === invoiceId) fetchInvoiceDetails(invoiceId);
    } catch { showFeedback(invoiceId, "Failed to send"); }
    finally { setSendingEmail(null); }
  };

  const handleAddNote = async (invoiceId: string) => {
    if (!noteText.trim()) return;
    setAddingNote(invoiceId);
    try {
      const res = await fetch(`/api/xero/invoices/${invoiceId}/note`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() }),
      });
      if (!res.ok) throw new Error();
      setNoteText(""); showFeedback(invoiceId, "Note added!");
      fetchInvoiceDetails(invoiceId);
    } catch { showFeedback(invoiceId, "Failed to add note"); }
    finally { setAddingNote(null); }
  };

  const handleStageChange = async (invoiceId: string, stage: ChaseStageKey) => {
    setChangingStage(invoiceId);
    try {
      const res = await fetch(`/api/xero/invoices/${invoiceId}/stage`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error();
      setInvoices(prev => prev.map(inv =>
        inv.InvoiceID === invoiceId ? { ...inv, chaseStage: { stage, updatedAt: new Date().toISOString(), updatedBy: user?.email || "" } } : inv
      ));
      showFeedback(invoiceId, "Stage updated!");
      if (expandedInvoice === invoiceId) fetchInvoiceDetails(invoiceId);
    } catch { showFeedback(invoiceId, "Failed to update stage"); }
    finally { setChangingStage(null); }
  };

  const handleRecordPayment = async () => {
    if (!showPaymentModal || !paymentAmount || !paymentBankId) return;
    setRecordingPayment(true);
    try {
      const res = await fetch("/api/xero/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: showPaymentModal, amount: parseFloat(paymentAmount), bankAccountId: paymentBankId, date: paymentDate }),
      });
      if (!res.ok) throw new Error();
      showFeedback(showPaymentModal, "Payment recorded!");
      setShowPaymentModal(null); setPaymentAmount("");
      fetchInvoices(true);
    } catch { showFeedback(showPaymentModal, "Failed to record"); }
    finally { setRecordingPayment(false); }
  };

  const showFeedback = (id: string, msg: string) => {
    setActionFeedback({ id, msg }); setTimeout(() => setActionFeedback(null), 3000);
  };

  // ── Computed Values ──

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    if (search) {
      const s = search.toLowerCase();
      if (!inv.Contact.Name.toLowerCase().includes(s) && !inv.InvoiceNumber?.toLowerCase().includes(s) && !inv.contactEmail?.toLowerCase().includes(s)) return false;
    }
    if (stageFilter !== "all") {
      if (stageFilter === "unassigned") { if (inv.chaseStage) return false; }
      else { if (inv.chaseStage?.stage !== stageFilter) return false; }
    }
    if (amountFilter === "1k" && inv.AmountDue < 1000) return false;
    if (amountFilter === "5k" && inv.AmountDue < 5000) return false;
    if (amountFilter === "10k" && inv.AmountDue < 10000) return false;
    return true;
  }), [invoices, search, stageFilter, amountFilter]);

  const totalOverdueAmount = useMemo(() => invoices.reduce((s, i) => s + i.AmountDue, 0), [invoices]);
  const avgDaysOverdue = useMemo(() => invoices.length > 0 ? Math.round(invoices.reduce((s, i) => s + i.daysOverdue, 0) / invoices.length) : 0, [invoices]);
  const medianDaysOverdue = useMemo(() => {
    if (!invoices.length) return 0;
    const sorted = invoices.map(i => i.daysOverdue).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }, [invoices]);
  const unassignedCount = useMemo(() => invoices.filter(i => !i.chaseStage).length, [invoices]);
  const over30Count = useMemo(() => invoices.filter(i => i.daysOverdue > 30).length, [invoices]);

  const tierBreakdown = useMemo(() => SEVERITY_TIERS.map(tier => {
    const tierInvs = invoices.filter(i => i.daysOverdue >= tier.min && i.daysOverdue <= tier.max);
    return { ...tier, count: tierInvs.length, total: tierInvs.reduce((s, i) => s + i.AmountDue, 0) };
  }), [invoices]);
  const totalForBar = useMemo(() => tierBreakdown.reduce((s, t) => s + t.count, 0), [tierBreakdown]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background p-6 pl-24 lg:p-8 lg:pl-32">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
              <p className="text-sm text-muted-foreground mt-1">Overdue invoices, chase tracking & payment management</p>
            </div>
            <button onClick={() => fetchInvoices(true, true)} disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-card border border-border hover:bg-accent transition-colors disabled:opacity-50">
              <ArrowsClockwise className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />Refresh
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-1 mb-6 border-b border-border">
          {([
            { key: "overdue" as TabKey, label: "Overdue Queue", icon: Warning, count: invoices.length },
            { key: "overview" as TabKey, label: "Overview", icon: ChartBar },
          ]).map(tab => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <TabIcon className="size-4" />{tab.label}
                {tab.count != null && tab.count > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/15 text-red-400">{tab.count}</span>}
                {isActive && <motion.div layoutId="finance-active-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              </button>
            );
          })}
          {isRefreshing && <div className="ml-auto shrink-0"><Spinner className="size-4 animate-spin text-muted-foreground/50" /></div>}
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => fetchInvoices()} className="text-xs font-medium hover:text-red-300 underline underline-offset-2">Retry</button>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          {initialLoading ? <LoadingSkeleton /> : (
            <>
              {/* ── OVERDUE QUEUE ── */}
              {activeTab === "overdue" && (
                <div className="space-y-4">
                  {/* Summary Panel */}
                  <div className="rounded-2xl bg-card border border-border overflow-hidden">
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border/50">
                      <StatCell label="Total Overdue" value={formatCurrency(totalOverdueAmount)} subText={`${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`} color="text-red-600 dark:text-red-400" />
                      <StatCell label="Avg Days Overdue" value={`${avgDaysOverdue}d`} subText={`Median: ${medianDaysOverdue}d`} color="text-foreground" />
                      <StatCell label="Unassigned" value={String(unassignedCount)} subText={`of ${invoices.length} total`} color={unassignedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"} />
                      <StatCell label="30+ Days Overdue" value={String(over30Count)}
                        color={over30Count > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}
                        subText={over30Count === 0 ? "All clear" : formatCurrency(invoices.filter(i => i.daysOverdue > 30).reduce((s, i) => s + i.AmountDue, 0))}
                        subColor={over30Count === 0 ? "text-emerald-600 dark:text-emerald-500" : undefined} />
                    </div>
                  </div>

                  {/* Aging Bar */}
                  <AgingBar tiers={tierBreakdown} total={totalForBar} />

                  {/* Filters */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, invoice #, email..."
                        className="w-full pl-9 pr-9 py-2 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"><X className="size-4" /></button>}
                    </div>
                    <div className="relative">
                      <Funnel className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                      <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                        className="pl-8 pr-8 py-2 rounded-lg bg-card border border-border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="all">All Stages</option>
                        <option value="unassigned">Unassigned</option>
                        {CHASE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-0.5 rounded-lg bg-card border border-border p-0.5">
                      {([{ key: "all" as AmountFilter, label: "All" }, { key: "1k" as AmountFilter, label: "> £1k" }, { key: "5k" as AmountFilter, label: "> £5k" }, { key: "10k" as AmountFilter, label: "> £10k" }]).map(f => (
                        <button key={f.key} onClick={() => setAmountFilter(f.key)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${amountFilter === f.key ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Invoice List */}
                  {filteredInvoices.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <CheckCircle className="size-12 mx-auto mb-3 opacity-30" />
                      <p className="text-lg font-medium">{search || stageFilter !== "all" || amountFilter !== "all" ? "No matching invoices" : "All clear!"}</p>
                      <p className="text-sm mt-1">{search || stageFilter !== "all" || amountFilter !== "all" ? "Try adjusting your filters" : "No overdue invoices"}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredInvoices.map(inv => (
                        <InvoiceRow key={inv.InvoiceID} invoice={inv}
                          isExpanded={expandedInvoice === inv.InvoiceID}
                          onToggle={() => setExpandedInvoice(expandedInvoice === inv.InvoiceID ? null : inv.InvoiceID)}
                          copiedEmail={copiedEmail} onCopyEmail={copyEmail}
                          sendingEmail={sendingEmail}
                          onStageChange={handleStageChange} changingStage={changingStage}
                          onOpenPayment={(id, amt) => { setShowPaymentModal(id); setPaymentAmount(amt.toFixed(2)); }}
                          noteText={noteText} onNoteTextChange={setNoteText} onAddNote={handleAddNote} addingNote={addingNote}
                          activities={expandedInvoice === inv.InvoiceID ? activities : []}
                          loadingActivities={expandedInvoice === inv.InvoiceID && loadingActivities}
                          actionFeedback={actionFeedback}
                          setShowSendConfirm={setShowSendConfirm}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── OVERVIEW ── */}
              {activeTab === "overview" && <OverviewTab overview={overview} invoices={invoices} tierBreakdown={tierBreakdown} totalForBar={totalForBar} />}
            </>
          )}
        </motion.div>

        {/* Payment Modal */}
        <AnimatePresence>
          {showPaymentModal && (
            <PaymentModal invoiceId={showPaymentModal} invoice={invoices.find(i => i.InvoiceID === showPaymentModal)}
              bankAccounts={bankAccounts} amount={paymentAmount} onAmountChange={setPaymentAmount}
              date={paymentDate} onDateChange={setPaymentDate} bankId={paymentBankId} onBankChange={setPaymentBankId}
              recording={recordingPayment} onRecord={handleRecordPayment} onClose={() => setShowPaymentModal(null)} />
          )}
        </AnimatePresence>

        {/* Send Reminder Confirmation */}
        <AnimatePresence>
          {showSendConfirm && (() => {
            const inv = invoices.find(i => i.InvoiceID === showSendConfirm);
            if (!inv) return null;
            return (
              <SendConfirmDialog email={inv.contactEmail} invoiceNumber={inv.InvoiceNumber}
                onConfirm={() => { handleSendEmail(showSendConfirm); setShowSendConfirm(null); }}
                onCancel={() => setShowSendConfirm(null)} sending={sendingEmail === showSendConfirm} />
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Stat Cell (inside unified panel) ──

function StatCell({ label, value, subText, color, subColor }: { label: string; value: string; subText?: string; color: string; subColor?: string }) {
  return (
    <div className="px-5 py-4 first:pl-6 last:pr-6">
      <p className="text-[11px] font-medium text-muted-foreground/70 tracking-wide mb-1.5">{label}</p>
      <p className={`text-[22px] font-bold tabular-nums leading-none ${color}`}>{value}</p>
      {subText && <p className={`text-[11px] mt-1.5 ${subColor || "text-muted-foreground/60"}`}>{subText}</p>}
    </div>
  );
}

// ── Stat Card (for overview tab) ──

function StatCard({ label, value, subText, color, subColor }: { label: string; value: string; subText?: string; color: string; subColor?: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {subText && <p className={`text-[11px] mt-0.5 ${subColor || "text-muted-foreground"}`}>{subText}</p>}
    </div>
  );
}

// ── Aging Breakdown Bar ──

function AgingBar({ tiers, total }: { tiers: { key: string; label: string; barColor: string; count: number; total: number }[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground tracking-wide mb-3">Aging Breakdown</p>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted/30 gap-px">
        {tiers.map(tier => {
          const pct = (tier.count / total) * 100;
          if (pct === 0) return null;
          return <motion.div key={tier.key} className={`${tier.barColor} rounded-sm`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />;
        })}
      </div>
      <div className="flex justify-between mt-2.5">
        {tiers.map(tier => (
          <div key={tier.key} className="flex items-center gap-1.5 text-[11px]">
            <span className={`inline-block w-2 h-2 rounded-sm ${tier.barColor}`} />
            <span className="text-muted-foreground">{tier.label}: {tier.count} · {formatCurrency(tier.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Invoice Row ──

function InvoiceRow({ invoice, isExpanded, onToggle, copiedEmail, onCopyEmail, sendingEmail, onStageChange, changingStage, onOpenPayment, noteText, onNoteTextChange, onAddNote, addingNote, activities, loadingActivities, actionFeedback, setShowSendConfirm }: {
  invoice: EnrichedInvoice; isExpanded: boolean; onToggle: () => void; copiedEmail: string | null;
  onCopyEmail: (email: string, id: string) => void; sendingEmail: string | null;
  onStageChange: (id: string, stage: ChaseStageKey) => void; changingStage: string | null;
  onOpenPayment: (id: string, amount: number) => void; noteText: string; onNoteTextChange: (t: string) => void;
  onAddNote: (id: string) => void; addingNote: string | null; activities: ChaseActivity[];
  loadingActivities: boolean; actionFeedback: { id: string; msg: string } | null;
  setShowSendConfirm: (id: string | null) => void;
}) {
  const tier = getSeverityTier(invoice.daysOverdue);
  const lastChased = getLastChasedTime(invoice);
  const stage = invoice.chaseStage ? getStageConfig(invoice.chaseStage.stage) : undefined;

  return (
    <div className={`rounded-lg bg-card border overflow-hidden transition-colors ${isExpanded ? "border-border shadow-md" : "border-border/40 hover:border-border/70"}`}>
      {/* Collapsed Row */}
      <div className={`flex items-center gap-2.5 py-2.5 px-3 cursor-pointer border-l-4 ${tier.borderColor} ${tier.rowTint}`} onClick={onToggle}>
        {/* Company + Invoice # */}
        <div className="min-w-0 w-[180px] shrink-0">
          <p className="text-[13px] font-semibold truncate leading-tight">{invoice.Contact.Name}</p>
          <span className="text-[11px] font-mono text-muted-foreground/60">{invoice.InvoiceNumber}</span>
        </div>

        {/* Days Badge */}
        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${tier.badgeBg} ${tier.badgeText}`}>
          {invoice.daysOverdue}d
        </span>

        {/* Email */}
        {invoice.contactEmail && (
          <button onClick={e => { e.stopPropagation(); onCopyEmail(invoice.contactEmail, invoice.InvoiceID); }}
            className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors truncate max-w-[220px] shrink min-w-0" title="Copy email">
            {copiedEmail === invoice.InvoiceID
              ? <><Check className="size-3 text-emerald-500 shrink-0" /><span className="text-emerald-500">Copied</span></>
              : <><CopySimple className="size-3 shrink-0 opacity-50" /><span className="truncate">{invoice.contactEmail}</span></>}
          </button>
        )}

        {/* Last Chased */}
        <span className={`hidden lg:block shrink-0 text-[11px] ${lastChased ? "text-muted-foreground/60" : "text-amber-500/80"}`}>
          {lastChased ? `Chased ${formatRelativeTime(lastChased)}` : "Never chased"}
        </span>

        {/* Feedback toast */}
        {actionFeedback?.id === invoice.InvoiceID && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="shrink-0 text-[10px] font-semibold text-emerald-500">{actionFeedback.msg}</motion.span>
        )}

        {/* Amount */}
        <div className="text-right shrink-0 w-24 ml-auto">
          <p className="text-[13px] font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrencyPrecise(invoice.AmountDue)}</p>
          {invoice.Total > invoice.AmountDue && <p className="text-[10px] text-muted-foreground/50">of {formatCurrency(invoice.Total)}</p>}
        </div>

        {/* Primary CTA */}
        <button onClick={e => { e.stopPropagation(); setShowSendConfirm(invoice.InvoiceID); }}
          disabled={sendingEmail === invoice.InvoiceID || !invoice.contactEmail}
          className="shrink-0 hidden sm:flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-30">
          {sendingEmail === invoice.InvoiceID ? <Spinner className="size-3 animate-spin" /> : <PaperPlaneTilt className="size-3" weight="fill" />}
          Remind
        </button>

        {/* Chevron */}
        <div className="shrink-0">{isExpanded ? <CaretDown className="size-4 text-muted-foreground/50" /> : <CaretRight className="size-4 text-muted-foreground/50" />}</div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-4 border-t border-border/30 space-y-4">
              {/* Details + Activity (two column) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: Invoice Details */}
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/30 dark:bg-muted/20 p-3.5">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                      <CompactDetail label="Invoice Date" value={formatDate(invoice.Date)} />
                      <CompactDetail label="Due Date" value={formatDate(invoice.DueDate)} />
                      <CompactDetail label="Reference" value={invoice.Reference || "—"} />
                      <CompactDetail label="Days Overdue" value={`${invoice.daysOverdue} days`} highlight={invoice.daysOverdue > 90} />
                      <CompactDetail label="Total" value={formatCurrencyPrecise(invoice.Total)} />
                      <CompactDetail label="Paid" value={formatCurrencyPrecise(invoice.AmountPaid)} />
                    </div>
                  </div>

                  {/* Note Input */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <ChatText className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
                      <input type="text" value={noteText} onChange={e => onNoteTextChange(e.target.value)} placeholder="Add a note..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                        onKeyDown={e => { if (e.key === "Enter" && noteText.trim()) onAddNote(invoice.InvoiceID); }} />
                    </div>
                    <button onClick={() => onAddNote(invoice.InvoiceID)} disabled={!noteText.trim() || addingNote === invoice.InvoiceID}
                      className="px-3 py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30">
                      {addingNote === invoice.InvoiceID ? <Spinner className="size-3.5 animate-spin" /> : "Add"}
                    </button>
                  </div>
                </div>

                {/* Right: Activity Timeline */}
                <div>
                  {loadingActivities ? (
                    <div className="flex items-center gap-2 py-6 text-muted-foreground/40"><Spinner className="size-3.5 animate-spin" /><span className="text-sm">Loading...</span></div>
                  ) : activities.length === 0 ? (
                    <div className="flex items-center gap-2.5 py-5 px-3 rounded-lg bg-muted/20 text-muted-foreground/50">
                      <Clock className="size-4 shrink-0" /><span className="text-sm">No chase activity — send first reminder</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-hide">
                      <p className="text-[11px] font-medium text-muted-foreground/60 mb-2">{activities.length} activit{activities.length !== 1 ? "ies" : "y"}</p>
                      {activities.map(act => (
                        <div key={act.id} className="flex items-start gap-2.5 py-1.5 border-l-2 border-border/40 pl-3">
                          <ActivityIcon action={act.action} />
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground/80 text-[12px] leading-snug">{act.detail}</p>
                            <p className="text-muted-foreground/40 text-[11px] mt-0.5">{act.user} · {formatTimestamp(act.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar (below details) */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/20">
                <button onClick={() => setShowSendConfirm(invoice.InvoiceID)} disabled={sendingEmail === invoice.InvoiceID || !invoice.contactEmail}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40">
                  {sendingEmail === invoice.InvoiceID ? <Spinner className="size-3.5 animate-spin" /> : <PaperPlaneTilt className="size-3.5" />} Send Reminder
                </button>
                <button onClick={() => onOpenPayment(invoice.InvoiceID, invoice.AmountDue)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-card border border-border hover:bg-accent transition-colors">
                  <CurrencyGbp className="size-3.5" /> Record Payment
                </button>
                <button onClick={() => onCopyEmail(invoice.contactEmail, invoice.InvoiceID)} disabled={!invoice.contactEmail}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
                  <CopySimple className="size-3.5" /> Copy Email
                </button>

                {stage && <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${stage.color} ${stage.textColor}`}><Tag className="size-3" />{stage.label}</span>}

                <div className="relative ml-auto">
                  <select value={invoice.chaseStage?.stage || ""} onChange={e => { if (e.target.value) onStageChange(invoice.InvoiceID, e.target.value as ChaseStageKey); }} disabled={changingStage === invoice.InvoiceID}
                    className="pl-7 pr-6 py-2 text-xs font-medium rounded-lg bg-card border border-border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50">
                    <option value="">Set Stage...</option>
                    {CHASE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Compact Detail ──

function CompactDetail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] text-muted-foreground/60">{label}</span>
      <span className={`text-[13px] font-medium tabular-nums ${highlight ? "text-red-400" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

// ── Activity Icon ──

function ActivityIcon({ action }: { action: string }) {
  switch (action) {
    case "stage_change": return <Tag className="size-3.5 text-blue-400 shrink-0 mt-0.5" />;
    case "note": return <ChatText className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />;
    case "payment_recorded": return <CurrencyGbp className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />;
    case "email_sent": return <EnvelopeSimple className="size-3.5 text-blue-400 shrink-0 mt-0.5" />;
    default: return <Clock className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />;
  }
}

// ── Overview Tab ──

function OverviewTab({ overview, invoices, tierBreakdown, totalForBar }: {
  overview: OverviewData | null; invoices: EnrichedInvoice[];
  tierBreakdown: { key: string; label: string; barColor: string; count: number; total: number }[]; totalForBar: number;
}) {
  if (!overview) return <div className="text-center py-16 text-muted-foreground/40"><Spinner className="size-8 mx-auto mb-3 animate-spin opacity-30" /><p className="text-sm">Loading overview...</p></div>;

  // Top debtors
  const debtorMap = new Map<string, { name: string; total: number; count: number }>();
  invoices.forEach(inv => {
    const key = inv.Contact.ContactID;
    const existing = debtorMap.get(key);
    if (existing) { existing.total += inv.AmountDue; existing.count += 1; }
    else debtorMap.set(key, { name: inv.Contact.Name, total: inv.AmountDue, count: 1 });
  });
  const topDebtors = Array.from(debtorMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Overdue" value={formatCurrency(overview.totalOverdue)} color="text-red-400" subText={`${overview.invoiceCount} invoices`} />
        <StatCard label="Overdue Invoices" value={String(overview.invoiceCount)} color="text-foreground" />
        <StatCard label="Total Outstanding" value={formatCurrency(overview.totalOutstanding)} color="text-amber-400" />
        <StatCard label="Avg Days Overdue" value={invoices.length > 0 ? `${Math.round(invoices.reduce((s, i) => s + i.daysOverdue, 0) / invoices.length)}d` : "0d"} color="text-foreground" />
      </div>

      <AgingBar tiers={tierBreakdown} total={totalForBar} />

      {/* Stage Breakdown */}
      <div>
        <p className="text-xs font-medium text-muted-foreground tracking-wide mb-3">Chase Stage Breakdown</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {overview.stageBreakdown["unassigned"] && (
            <div className="rounded-xl bg-card border border-border p-3">
              <div className="flex items-center gap-1.5 mb-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /><p className="text-xs font-semibold text-muted-foreground">Unassigned</p></div>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(overview.stageBreakdown["unassigned"].total)}</p>
              <p className="text-[10px] text-muted-foreground">{overview.stageBreakdown["unassigned"].count} invoices</p>
            </div>
          )}
          {CHASE_STAGES.map(sc => {
            const data = overview.stageBreakdown[sc.key];
            if (!data) return null;
            return (
              <div key={sc.key} className="rounded-xl bg-card border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2"><span className={`inline-block w-2.5 h-2.5 rounded-full ${sc.color.replace("/15", "").replace("/20", "")}`} /><p className="text-xs font-semibold truncate">{sc.label}</p></div>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(data.total)}</p>
                <p className="text-[10px] text-muted-foreground">{data.count} invoice{data.count !== 1 ? "s" : ""}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Debtors */}
      {topDebtors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground tracking-wide mb-3">Top Debtors</p>
          <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border/30">
            {topDebtors.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground/50 font-mono w-5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground">{d.count} invoice{d.count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-red-400 tabular-nums">{formatCurrency(d.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payment Modal ──

function PaymentModal({ invoiceId, invoice, bankAccounts, amount, onAmountChange, date, onDateChange, bankId, onBankChange, recording, onRecord, onClose }: {
  invoiceId: string; invoice?: EnrichedInvoice; bankAccounts: XeroBankAccount[];
  amount: string; onAmountChange: (v: string) => void; date: string; onDateChange: (v: string) => void;
  bankId: string; onBankChange: (v: string) => void; recording: boolean; onRecord: () => void; onClose: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">Record Payment</h3>
        {invoice && <p className="text-sm text-muted-foreground mb-4">{invoice.Contact.Name} · {invoice.InvoiceNumber}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Amount (£)</label>
            <input type="number" value={amount} onChange={e => onAmountChange(e.target.value)} step="0.01" min="0"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bank Account</label>
            <select value={bankId} onChange={e => onBankChange(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Select bank account...</option>
              {bankAccounts.map(acc => <option key={acc.AccountID} value={acc.AccountID}>{acc.Name} ({acc.Code})</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onRecord} disabled={recording || !amount || !bankId}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
            {recording ? <Spinner className="size-4 animate-spin" /> : <CurrencyGbp className="size-4" />} Record Payment
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Send Confirmation Dialog ──

function SendConfirmDialog({ email, invoiceNumber, onConfirm, onCancel, sending }: {
  email: string; invoiceNumber: string; onConfirm: () => void; onCancel: () => void; sending: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-blue-500/10"><EnvelopeSimple className="size-5 text-blue-400" /></div>
          <div>
            <h3 className="text-sm font-bold">Send Payment Reminder</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Invoice {invoiceNumber}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Send a payment reminder email to <span className="text-foreground font-medium">{email}</span>?
        </p>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={sending}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
            {sending ? <Spinner className="size-4 animate-spin" /> : <PaperPlaneTilt className="size-4" />} Send
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Loading Skeleton ──

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-4 animate-pulse">
            <div className="h-3 w-20 bg-muted rounded mb-2" /><div className="h-7 w-28 bg-muted rounded mb-1" /><div className="h-2.5 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-card border border-border p-4 animate-pulse">
        <div className="h-3 w-32 bg-muted rounded mb-3" /><div className="h-3 w-full bg-muted rounded-full" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-card border border-border/40 p-2.5 animate-pulse border-l-4 border-l-muted">
            <div className="flex items-center gap-3">
              <div className="h-4 w-36 bg-muted rounded" /><div className="h-5 w-10 bg-muted rounded" />
              <div className="h-3 w-40 bg-muted rounded" /><div className="h-3 w-20 bg-muted rounded" />
              <div className="ml-auto h-4 w-20 bg-muted rounded" /><div className="h-7 w-16 bg-muted rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
