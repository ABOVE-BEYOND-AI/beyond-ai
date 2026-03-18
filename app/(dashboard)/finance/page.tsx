"use client";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Warning,
  CheckCircle,
  Clock,
  Receipt,
  CreditCard,
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
  Timer,
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

// ── Chase stage config (matches lib/xero.ts) ──

const CHASE_STAGES: ChaseStageConfig[] = [
  { key: "1-3_days_xero_reminder", label: "1-3 days Xero Reminder", color: "bg-green-100", textColor: "text-green-700", description: "Automated Xero reminder sent" },
  { key: "3-5_days_finance_email", label: "3-5 days Finance Email", color: "bg-blue-100", textColor: "text-blue-700", description: "Finance team sends manual email" },
  { key: "8_days_process_email", label: "8 days Process + Email", color: "bg-orange-100", textColor: "text-orange-700", description: "Attempt to take payment + email" },
  { key: "10_days_process_email", label: "10 days Process + Email", color: "bg-purple-100", textColor: "text-purple-700", description: "Second attempt to process + email" },
  { key: "daily_chaser", label: "Daily Chaser", color: "bg-amber-100", textColor: "text-amber-700", description: "Daily follow-up" },
  { key: "final_warning", label: "Final Warning", color: "bg-red-100", textColor: "text-red-600", description: "Last warning before cancellation" },
  { key: "cancellation_terms", label: "Cancellation Terms", color: "bg-red-200", textColor: "text-red-800", description: "Cancellation terms issued" },
  { key: "bolt_on", label: "BOLT ON", color: "bg-emerald-100", textColor: "text-emerald-800", description: "Bolt-on / resolved" },
];

const getStageConfig = (key: string): ChaseStageConfig | undefined =>
  CHASE_STAGES.find((s) => s.key === key);

// ── Helpers ──

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "£0.00";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(amount);
}

function daysOverdueColor(days: number): string {
  if (days <= 7) return "text-amber-500";
  if (days <= 14) return "text-orange-500";
  if (days <= 30) return "text-red-500";
  return "text-red-600 font-bold";
}

function daysOverdueBg(days: number): string {
  if (days <= 7) return "bg-amber-500/10 border-amber-500/20";
  if (days <= 14) return "bg-orange-500/10 border-orange-500/20";
  if (days <= 30) return "bg-red-500/10 border-red-500/20";
  return "bg-red-600/15 border-red-500/30";
}

type TabKey = "overdue" | "overview";

// ── Overview Types ──

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

  // Data
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [bankAccounts, setBankAccounts] = useState<XeroBankAccount[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<TabKey>("overdue");
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const hasFetchedOnce = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Action States
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

  // Activity data for expanded invoice
  const [activities, setActivities] = useState<ChaseActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // ── Data Fetching ──

  const fetchInvoices = useCallback(async (silent = false) => {
    if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
    if (silent) setIsRefreshing(true);
    setError(null);

    try {
      const res = await fetch("/api/xero/invoices");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch invoices");
      }
      const json = await res.json();
      if (json.success) {
        setInvoices(json.data || []);
        hasFetchedOnce.current = true;
      } else {
        throw new Error(json.error || "Unknown error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load finance data";
      console.error("Finance fetch error:", err);
      setError(message);
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/xero/overview");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setOverview(json.data);
    } catch (err) {
      console.error("Overview fetch error:", err);
    }
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/xero/bank-accounts");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setBankAccounts(json.data || []);
    } catch (err) {
      console.error("Bank accounts fetch error:", err);
    }
  }, []);

  const fetchInvoiceDetails = useCallback(async (invoiceId: string) => {
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/xero/invoices/${invoiceId}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setActivities(json.data.activities || []);
      }
    } catch (err) {
      console.error("Invoice detail fetch error:", err);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchInvoices(hasFetchedOnce.current);
      fetchOverview();
      fetchBankAccounts();
    }
  }, [user, fetchInvoices, fetchOverview, fetchBankAccounts]);

  // Polling every 2 minutes
  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(() => {
      fetchInvoices(true);
      fetchOverview();
    }, 120_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, fetchInvoices, fetchOverview]);

  // Fetch details when expanding an invoice
  useEffect(() => {
    if (expandedInvoice) {
      fetchInvoiceDetails(expandedInvoice);
    }
  }, [expandedInvoice, fetchInvoiceDetails]);

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
      if (!res.ok) throw new Error("Failed to send email");
      showFeedback(invoiceId, "Reminder email sent!");
      fetchInvoiceDetails(invoiceId);
    } catch (err) {
      showFeedback(invoiceId, "Failed to send email");
    } finally {
      setSendingEmail(null);
    }
  };

  const handleAddNote = async (invoiceId: string) => {
    if (!noteText.trim()) return;
    setAddingNote(invoiceId);
    try {
      const res = await fetch(`/api/xero/invoices/${invoiceId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNoteText("");
      showFeedback(invoiceId, "Note added!");
      fetchInvoiceDetails(invoiceId);
    } catch (err) {
      showFeedback(invoiceId, "Failed to add note");
    } finally {
      setAddingNote(null);
    }
  };

  const handleStageChange = async (invoiceId: string, stage: ChaseStageKey) => {
    setChangingStage(invoiceId);
    try {
      const res = await fetch(`/api/xero/invoices/${invoiceId}/stage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      // Update local state
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.InvoiceID === invoiceId
            ? { ...inv, chaseStage: { stage, updatedAt: new Date().toISOString(), updatedBy: user?.email || "" } }
            : inv
        )
      );
      showFeedback(invoiceId, "Stage updated!");
      fetchInvoiceDetails(invoiceId);
    } catch (err) {
      showFeedback(invoiceId, "Failed to update stage");
    } finally {
      setChangingStage(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!showPaymentModal || !paymentAmount || !paymentBankId) return;
    setRecordingPayment(true);
    try {
      const res = await fetch("/api/xero/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: showPaymentModal,
          amount: parseFloat(paymentAmount),
          bankAccountId: paymentBankId,
          date: paymentDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to record payment");
      showFeedback(showPaymentModal, "Payment recorded!");
      setShowPaymentModal(null);
      setPaymentAmount("");
      // Refresh data
      fetchInvoices(true);
    } catch (err) {
      showFeedback(showPaymentModal, "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  const showFeedback = (id: string, msg: string) => {
    setActionFeedback({ id, msg });
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // ── Filtering ──

  const filteredInvoices = invoices.filter((inv) => {
    if (search) {
      const s = search.toLowerCase();
      const matchName = inv.Contact.Name.toLowerCase().includes(s);
      const matchNumber = inv.InvoiceNumber?.toLowerCase().includes(s);
      const matchEmail = inv.contactEmail?.toLowerCase().includes(s);
      if (!matchName && !matchNumber && !matchEmail) return false;
    }
    if (stageFilter !== "all") {
      if (stageFilter === "unassigned") {
        if (inv.chaseStage) return false;
      } else {
        if (inv.chaseStage?.stage !== stageFilter) return false;
      }
    }
    return true;
  });

  // Compute quick stats from current invoices
  const totalOverdueAmount = invoices.reduce((sum, inv) => sum + inv.AmountDue, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background p-6 pl-24 lg:p-8 lg:pl-32">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Overdue invoices, chase tracking, and payment management
              </p>
            </div>
            <button
              onClick={() => fetchInvoices(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-card border border-border hover:bg-accent transition-colors disabled:opacity-50"
            >
              <ArrowsClockwise className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-1 mb-6 border-b border-border"
        >
          {([
            { key: "overdue" as TabKey, label: "Overdue Queue", icon: Warning, count: invoices.length },
            { key: "overview" as TabKey, label: "Overview", icon: ChartBar },
          ]).map((tab) => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TabIcon className="size-4" />
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/15 text-red-400">
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="finance-active-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
          {isRefreshing && (
            <div className="ml-auto shrink-0">
              <Spinner className="size-4 animate-spin text-muted-foreground/50" />
            </div>
          )}
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-between"
          >
            <span>{error}</span>
            <button onClick={() => fetchInvoices()} className="text-xs font-medium hover:text-red-300 underline underline-offset-2">
              Retry
            </button>
          </motion.div>
        )}

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {initialLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* ── OVERDUE QUEUE TAB ── */}
              {activeTab === "overdue" && (
                <div className="space-y-4">
                  {/* Stats Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total Overdue" value={formatCurrency(totalOverdueAmount)} color="text-red-400" />
                    <StatCard label="Invoices" value={String(invoices.length)} color="text-foreground" />
                    <StatCard
                      label="Unassigned"
                      value={String(invoices.filter((i) => !i.chaseStage).length)}
                      color="text-amber-400"
                    />
                    <StatCard
                      label="30+ Days"
                      value={String(invoices.filter((i) => i.daysOverdue > 30).length)}
                      color="text-red-600"
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search client, invoice #, email..."
                        className="w-full pl-9 pr-9 py-2 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                      />
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <Funnel className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                      <select
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        className="pl-8 pr-8 py-2 rounded-lg bg-card border border-border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="all">All Stages</option>
                        <option value="unassigned">Unassigned</option>
                        {CHASE_STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Invoice List */}
                  {filteredInvoices.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <CheckCircle className="size-12 mx-auto mb-3 opacity-30" />
                      <p className="text-lg font-medium">
                        {search || stageFilter !== "all" ? "No matching invoices" : "All clear!"}
                      </p>
                      <p className="text-sm mt-1">
                        {search || stageFilter !== "all"
                          ? "Try adjusting your filters"
                          : "No overdue invoices right now"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredInvoices.map((inv) => (
                        <InvoiceRow
                          key={inv.InvoiceID}
                          invoice={inv}
                          isExpanded={expandedInvoice === inv.InvoiceID}
                          onToggle={() =>
                            setExpandedInvoice(
                              expandedInvoice === inv.InvoiceID ? null : inv.InvoiceID
                            )
                          }
                          copiedEmail={copiedEmail}
                          onCopyEmail={copyEmail}
                          onSendEmail={handleSendEmail}
                          sendingEmail={sendingEmail}
                          onStageChange={handleStageChange}
                          changingStage={changingStage}
                          onOpenPayment={(id, amount) => {
                            setShowPaymentModal(id);
                            setPaymentAmount(amount.toFixed(2));
                          }}
                          noteText={noteText}
                          onNoteTextChange={setNoteText}
                          onAddNote={handleAddNote}
                          addingNote={addingNote}
                          activities={expandedInvoice === inv.InvoiceID ? activities : []}
                          loadingActivities={
                            expandedInvoice === inv.InvoiceID && loadingActivities
                          }
                          actionFeedback={actionFeedback}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── OVERVIEW TAB ── */}
              {activeTab === "overview" && (
                <OverviewTab overview={overview} invoices={invoices} />
              )}
            </>
          )}
        </motion.div>

        {/* ── Payment Modal ── */}
        <AnimatePresence>
          {showPaymentModal && (
            <PaymentModal
              invoiceId={showPaymentModal}
              invoice={invoices.find((i) => i.InvoiceID === showPaymentModal)}
              bankAccounts={bankAccounts}
              amount={paymentAmount}
              onAmountChange={setPaymentAmount}
              date={paymentDate}
              onDateChange={setPaymentDate}
              bankId={paymentBankId}
              onBankChange={setPaymentBankId}
              recording={recordingPayment}
              onRecord={handleRecordPayment}
              onClose={() => setShowPaymentModal(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Stat Card ──

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

// ── Invoice Row ──

function InvoiceRow({
  invoice,
  isExpanded,
  onToggle,
  copiedEmail,
  onCopyEmail,
  onSendEmail,
  sendingEmail,
  onStageChange,
  changingStage,
  onOpenPayment,
  noteText,
  onNoteTextChange,
  onAddNote,
  addingNote,
  activities,
  loadingActivities,
  actionFeedback,
}: {
  invoice: EnrichedInvoice;
  isExpanded: boolean;
  onToggle: () => void;
  copiedEmail: string | null;
  onCopyEmail: (email: string, id: string) => void;
  onSendEmail: (id: string) => void;
  sendingEmail: string | null;
  onStageChange: (id: string, stage: ChaseStageKey) => void;
  changingStage: string | null;
  onOpenPayment: (id: string, amount: number) => void;
  noteText: string;
  onNoteTextChange: (text: string) => void;
  onAddNote: (id: string) => void;
  addingNote: string | null;
  activities: ChaseActivity[];
  loadingActivities: boolean;
  actionFeedback: { id: string; msg: string } | null;
}) {
  const stage = invoice.chaseStage
    ? getStageConfig(invoice.chaseStage.stage)
    : undefined;

  return (
    <div
      className={`rounded-xl bg-card border transition-colors ${
        isExpanded ? "border-border shadow-md" : "border-border/50 hover:border-border"
      }`}
    >
      {/* Main Row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={onToggle}
      >
        {/* Expand Arrow */}
        <div className="shrink-0">
          {isExpanded ? (
            <CaretDown className="size-4 text-muted-foreground" />
          ) : (
            <CaretRight className="size-4 text-muted-foreground" />
          )}
        </div>

        {/* Days Overdue Badge */}
        <div
          className={`shrink-0 px-2 py-1 rounded-md border text-xs font-bold tabular-nums ${daysOverdueBg(
            invoice.daysOverdue
          )} ${daysOverdueColor(invoice.daysOverdue)}`}
        >
          {invoice.daysOverdue}d
        </div>

        {/* Client & Invoice Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{invoice.Contact.Name}</p>
            {invoice.InvoiceNumber && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {invoice.InvoiceNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {invoice.contactEmail && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyEmail(invoice.contactEmail, invoice.InvoiceID);
                }}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                title="Click to copy email"
              >
                {copiedEmail === invoice.InvoiceID ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span className="text-emerald-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <CopySimple className="size-3" />
                    <span className="truncate max-w-[180px]">{invoice.contactEmail}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Chase Stage */}
        <div className="shrink-0">
          {stage ? (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${stage.color} ${stage.textColor}`}
            >
              <Tag className="size-3" />
              {stage.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
              <Tag className="size-3" />
              Unassigned
            </span>
          )}
        </div>

        {/* Amount */}
        <div className="text-right shrink-0 w-28">
          <p className="text-sm font-bold text-red-400 tabular-nums">
            {formatCurrency(invoice.AmountDue)}
          </p>
          {invoice.AmountPaid > 0 && (
            <p className="text-[10px] text-emerald-500 font-medium">
              Paid: {formatCurrency(invoice.AmountPaid)}
            </p>
          )}
        </div>

        {/* Feedback */}
        {actionFeedback?.id === invoice.InvoiceID && (
          <span className="shrink-0 text-[10px] font-semibold text-emerald-500 animate-pulse">
            {actionFeedback.msg}
          </span>
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-4">
              {/* Invoice Details */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
                <DetailItem label="Invoice #" value={invoice.InvoiceNumber || "—"} />
                <DetailItem label="Invoice Date" value={formatDate(invoice.Date)} />
                <DetailItem label="Due Date" value={formatDate(invoice.DueDate)} />
                <DetailItem label="Total" value={formatCurrency(invoice.Total)} />
                <DetailItem label="Amount Due" value={formatCurrency(invoice.AmountDue)} />
                <DetailItem label="Amount Paid" value={formatCurrency(invoice.AmountPaid)} />
                <DetailItem label="Reference" value={invoice.Reference || "—"} />
                <DetailItem label="Days Overdue" value={`${invoice.daysOverdue} days`} />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onCopyEmail(invoice.contactEmail, invoice.InvoiceID)}
                  disabled={!invoice.contactEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-card border border-border hover:bg-accent transition-colors disabled:opacity-30"
                >
                  <CopySimple className="size-3.5" />
                  Copy Email
                </button>

                <button
                  onClick={() => onSendEmail(invoice.InvoiceID)}
                  disabled={sendingEmail === invoice.InvoiceID}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                >
                  {sendingEmail === invoice.InvoiceID ? (
                    <Spinner className="size-3.5 animate-spin" />
                  ) : (
                    <EnvelopeSimple className="size-3.5" />
                  )}
                  Send Reminder
                </button>

                <button
                  onClick={() => onOpenPayment(invoice.InvoiceID, invoice.AmountDue)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <CurrencyGbp className="size-3.5" />
                  Record Payment
                </button>

                {/* Stage Dropdown */}
                <div className="relative">
                  <select
                    value={invoice.chaseStage?.stage || ""}
                    onChange={(e) => {
                      if (e.target.value) onStageChange(invoice.InvoiceID, e.target.value as ChaseStageKey);
                    }}
                    disabled={changingStage === invoice.InvoiceID}
                    className="pl-7 pr-6 py-1.5 text-xs font-medium rounded-lg bg-card border border-border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  >
                    <option value="">Set Stage...</option>
                    {CHASE_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                </div>
              </div>

              {/* Add Note */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <ChatText className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => onNoteTextChange(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-card border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && noteText.trim()) onAddNote(invoice.InvoiceID);
                    }}
                  />
                </div>
                <button
                  onClick={() => onAddNote(invoice.InvoiceID)}
                  disabled={!noteText.trim() || addingNote === invoice.InvoiceID}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
                >
                  {addingNote === invoice.InvoiceID ? (
                    <Spinner className="size-3.5 animate-spin" />
                  ) : (
                    <PaperPlaneTilt className="size-3.5" />
                  )}
                  Add
                </button>
              </div>

              {/* Activity Timeline */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Activity Log
                </h4>
                {loadingActivities ? (
                  <div className="flex items-center gap-2 py-3 text-muted-foreground/40">
                    <Spinner className="size-3.5 animate-spin" />
                    <span className="text-xs">Loading activity...</span>
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground/40 py-2">
                    No activity recorded yet
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {activities.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start gap-2 text-xs py-1.5 border-l-2 border-border pl-3"
                      >
                        <ActivityIcon action={act.action} />
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground">{act.detail}</p>
                          <p className="text-muted-foreground/50 text-[10px] mt-0.5">
                            {act.user} &middot; {formatTimestamp(act.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Activity Icon ──

function ActivityIcon({ action }: { action: string }) {
  switch (action) {
    case "stage_change":
      return <Tag className="size-3.5 text-blue-400 shrink-0 mt-0.5" />;
    case "note":
      return <ChatText className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />;
    case "payment_recorded":
      return <CurrencyGbp className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />;
    case "email_sent":
      return <EnvelopeSimple className="size-3.5 text-blue-400 shrink-0 mt-0.5" />;
    default:
      return <Clock className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />;
  }
}

// ── Detail Item ──

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab({
  overview,
  invoices,
}: {
  overview: OverviewData | null;
  invoices: EnrichedInvoice[];
}) {
  if (!overview) {
    return (
      <div className="text-center py-16 text-muted-foreground/40">
        <Spinner className="size-8 mx-auto mb-3 animate-spin opacity-30" />
        <p className="text-sm">Loading overview...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Overdue"
          value={formatCurrency(overview.totalOverdue)}
          color="text-red-400"
        />
        <StatCard
          label="Overdue Invoices"
          value={String(overview.invoiceCount)}
          color="text-foreground"
        />
        <StatCard
          label="Total Outstanding"
          value={formatCurrency(overview.totalOutstanding)}
          color="text-amber-400"
        />
        <StatCard
          label="Avg Days Overdue"
          value={
            invoices.length > 0
              ? `${Math.round(invoices.reduce((s, i) => s + i.daysOverdue, 0) / invoices.length)}d`
              : "0d"
          }
          color="text-foreground"
        />
      </div>

      {/* Aging Buckets */}
      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
          Aging Analysis
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {overview.agingBuckets.map((bucket) => (
            <div
              key={bucket.label}
              className="rounded-xl bg-card border border-border p-4"
            >
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {bucket.label}
              </p>
              <p className="text-xl font-bold tabular-nums mt-1">
                {formatCurrency(bucket.total)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {bucket.count} invoice{bucket.count !== 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stage Breakdown */}
      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
          Chase Stage Breakdown
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Unassigned */}
          {overview.stageBreakdown["unassigned"] && (
            <div className="rounded-xl bg-card border border-border p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                <p className="text-xs font-semibold text-muted-foreground">Unassigned</p>
              </div>
              <p className="text-lg font-bold tabular-nums">
                {formatCurrency(overview.stageBreakdown["unassigned"].total)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {overview.stageBreakdown["unassigned"].count} invoices
              </p>
            </div>
          )}

          {CHASE_STAGES.map((stageConfig) => {
            const data = overview.stageBreakdown[stageConfig.key];
            if (!data) return null;
            return (
              <div
                key={stageConfig.key}
                className="rounded-xl bg-card border border-border p-3"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${stageConfig.color.replace(
                      "100",
                      "500"
                    )}`}
                  />
                  <p className="text-xs font-semibold truncate">{stageConfig.label}</p>
                </div>
                <p className="text-lg font-bold tabular-nums">
                  {formatCurrency(data.total)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {data.count} invoice{data.count !== 1 ? "s" : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Payment Modal ──

function PaymentModal({
  invoiceId,
  invoice,
  bankAccounts,
  amount,
  onAmountChange,
  date,
  onDateChange,
  bankId,
  onBankChange,
  recording,
  onRecord,
  onClose,
}: {
  invoiceId: string;
  invoice?: EnrichedInvoice;
  bankAccounts: XeroBankAccount[];
  amount: string;
  onAmountChange: (v: string) => void;
  date: string;
  onDateChange: (v: string) => void;
  bankId: string;
  onBankChange: (v: string) => void;
  recording: boolean;
  onRecord: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-1">Record Payment</h3>
        {invoice && (
          <p className="text-sm text-muted-foreground mb-4">
            {invoice.Contact.Name} &middot; {invoice.InvoiceNumber}
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Amount (£)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              step="0.01"
              min="0"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Bank Account
            </label>
            <select
              value={bankId}
              onChange={(e) => onBankChange(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select bank account...</option>
              {bankAccounts.map((acc) => (
                <option key={acc.AccountID} value={acc.AccountID}>
                  {acc.Name} ({acc.Code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onRecord}
            disabled={recording || !amount || !bankId}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {recording ? (
              <Spinner className="size-4 animate-spin" />
            ) : (
              <CurrencyGbp className="size-4" />
            )}
            Record Payment
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Loading Skeleton ──

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-4 animate-pulse">
            <div className="h-3 w-20 bg-muted rounded mb-3" />
            <div className="h-7 w-28 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-6 w-10 bg-muted rounded" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-muted rounded mb-1.5" />
                <div className="h-3 w-28 bg-muted rounded" />
              </div>
              <div className="h-5 w-24 bg-muted rounded-full" />
              <div className="h-5 w-20 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Date Helpers ──

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return ts;
  }
}
