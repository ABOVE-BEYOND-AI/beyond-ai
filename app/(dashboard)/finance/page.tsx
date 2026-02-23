"use client";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CurrencyGbp,
  Warning,
  CheckCircle,
  Clock,
  Receipt,
  CreditCard,
  ArrowDown,
  ArrowUp,
  MagnifyingGlass,
  X,
  Spinner,
  ChartBar,
  Bank,
} from "@phosphor-icons/react";

// ── Types ──

interface FinanceOverview {
  totalInvoiced: number;
  totalPaid: number;
  totalDue: number;
  totalOverdue: number;
  totalCredits: number;
  totalDraft: number;
  collectionRate: number;
}

interface FinanceAccount {
  Id: string;
  Name: string;
  Bread_Winner__Total_Amount_Invoiced__c: number | null;
  Bread_Winner__Total_Amount_Paid__c: number | null;
  Bread_Winner__Total_Amount_Due__c: number | null;
  Bread_Winner__Total_Amount_Overdue__c: number | null;
  Bread_Winner__Total_Unallocated_Credit__c: number | null;
  Bread_Winner__Total_Draft_Amount__c: number | null;
}

interface PaymentPlan {
  Id: string;
  Name: string;
  Account: { Name: string } | null;
  Event__r: { Name: string; Category__c?: string } | null;
  Gross_Amount__c: number | null;
  Amount: number | null;
  Total_Amount_Paid__c: number | null;
  Total_Balance__c: number | null;
  Percentage_Paid__c: number | null;
  Payment_Progress__c: string | null;
  Owner: { Name: string } | null;
  StageName: string;
}

interface CreditAccount {
  Id: string;
  Name: string;
  Bread_Winner__Total_Unallocated_Credit__c: number | null;
  Bread_Winner__Total_Amount_Invoiced__c: number | null;
  Bread_Winner__Total_Amount_Paid__c: number | null;
}

type TabKey = "overview" | "invoices" | "overdue" | "credits" | "payments";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: ChartBar },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "overdue", label: "Overdue", icon: Warning },
  { key: "credits", label: "Credits", icon: CreditCard },
  { key: "payments", label: "Payment Plans", icon: Bank },
];

// ── Helpers ──

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "£0";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatCurrencyPrecise(amount: number | null | undefined): string {
  if (amount == null) return "£0.00";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(amount);
}

// ── Metric Card ──

function MetricCard({
  label,
  value,
  icon: Icon,
  color = "foreground",
  subValue,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color?: string;
  subValue?: string;
}) {
  const colorClasses: Record<string, string> = {
    foreground: "text-foreground",
    emerald: "text-emerald-500",
    red: "text-red-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    violet: "text-violet-400",
  };

  return (
    <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-4 ${colorClasses[color] || "text-muted-foreground"}`} />
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </p>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${colorClasses[color] || "text-foreground"}`}>
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-muted-foreground/60 mt-0.5">{subValue}</p>
      )}
    </div>
  );
}

// ── Payment Progress Bar ──

function PaymentProgressBar({ percentage }: { percentage: number | null }) {
  const pct = Math.min(percentage ?? 0, 100);
  const color = pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct > 0 ? "bg-amber-500" : "bg-muted-foreground/30";

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="h-1.5 flex-1 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums text-muted-foreground w-10 text-right">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ── Main Component ──

export default function FinancePage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  // Data
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [overdueAccounts, setOverdueAccounts] = useState<FinanceAccount[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);

  // UI
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const hasFetchedOnce = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // Fetch all finance data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
    if (silent) setIsRefreshing(true);
    setError(null);

    try {
      const res = await fetch("/api/finance");
      if (!res.ok) throw new Error("Failed to fetch finance data");
      const json = await res.json();

      if (json.success) {
        setOverview(json.data.overview);
        setAccounts(json.data.accounts || []);

        // Filter overdue from accounts
        const overdue = (json.data.accounts || []).filter(
          (a: FinanceAccount) => (a.Bread_Winner__Total_Amount_Overdue__c ?? 0) > 0
        );
        setOverdueAccounts(overdue);
        setCreditAccounts(json.data.creditAccounts || []);
        setPaymentPlans(json.data.paymentPlans || []);
        hasFetchedOnce.current = true;
      } else {
        throw new Error(json.error || "Unknown error");
      }
    } catch (err) {
      console.error("Finance fetch error:", err);
      setError("Failed to load finance data. Please try again.");
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData(hasFetchedOnce.current);
  }, [user, fetchData]);

  // Polling every 2 minutes
  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(() => fetchData(true), 120_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, fetchData]);

  // Search filter for accounts
  const filterBySearch = <T extends { Name: string }>(items: T[]): T[] => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(item => item.Name.toLowerCase().includes(s));
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invoices, payments, credits, and collection tracking
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto"
        >
          {TABS.map((tab) => {
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
                {tab.key === "overdue" && overdueAccounts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/15 text-red-400">
                    {overdueAccounts.length}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => fetchData()} className="text-xs font-medium hover:text-red-300 underline underline-offset-2">Retry</button>
          </motion.div>
        )}

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {initialLoading ? (
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
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-card border border-border p-4 animate-pulse">
                    <div className="flex justify-between">
                      <div className="h-4 w-40 bg-muted rounded" />
                      <div className="h-4 w-20 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* ── OVERVIEW TAB ── */}
              {activeTab === "overview" && overview && (
                <div className="space-y-6">
                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard label="Total Invoiced" value={formatCurrency(overview.totalInvoiced)} icon={Receipt} color="foreground" />
                    <MetricCard label="Total Paid" value={formatCurrency(overview.totalPaid)} icon={CheckCircle} color="emerald" subValue={`${overview.collectionRate.toFixed(1)}% collection rate`} />
                    <MetricCard label="Outstanding" value={formatCurrency(overview.totalDue)} icon={Clock} color="amber" />
                    <MetricCard label="Overdue" value={formatCurrency(overview.totalOverdue)} icon={Warning} color="red" subValue={`${overdueAccounts.length} accounts`} />
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <MetricCard label="Credits Available" value={formatCurrency(overview.totalCredits)} icon={CreditCard} color="violet" subValue={`${creditAccounts.length} accounts`} />
                    <MetricCard label="Draft Invoices" value={formatCurrency(overview.totalDraft)} icon={Receipt} color="blue" />
                    <MetricCard label="Active Payment Plans" value={String(paymentPlans.length)} icon={Bank} color="foreground" />
                  </div>

                  {/* Overdue Alert */}
                  {overdueAccounts.length > 0 && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Warning className="size-5 text-red-400" weight="fill" />
                        <h3 className="text-sm font-bold text-red-400">Overdue Accounts</h3>
                      </div>
                      <div className="space-y-2">
                        {overdueAccounts.slice(0, 5).map((account) => (
                          <div key={account.Id} className="flex items-center justify-between p-2 rounded-lg bg-red-500/5">
                            <span className="text-sm font-medium text-foreground truncate">{account.Name}</span>
                            <span className="text-sm font-bold text-red-400 tabular-nums shrink-0">
                              {formatCurrencyPrecise(account.Bread_Winner__Total_Amount_Overdue__c)}
                            </span>
                          </div>
                        ))}
                        {overdueAccounts.length > 5 && (
                          <button onClick={() => setActiveTab("overdue")} className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
                            View all {overdueAccounts.length} overdue accounts →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Top Accounts by Invoice Value */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
                      Top Accounts by Invoice Volume
                    </h3>
                    <div className="space-y-1.5">
                      {accounts.slice(0, 10).map((account) => (
                        <div key={account.Id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-border transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{account.Name}</p>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <p className="text-sm font-bold tabular-nums">{formatCurrency(account.Bread_Winner__Total_Amount_Invoiced__c)}</p>
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-[10px] text-emerald-500 font-medium">
                                Paid: {formatCurrency(account.Bread_Winner__Total_Amount_Paid__c)}
                              </span>
                              {(account.Bread_Winner__Total_Amount_Overdue__c ?? 0) > 0 && (
                                <span className="text-[10px] text-red-400 font-medium">
                                  Overdue: {formatCurrency(account.Bread_Winner__Total_Amount_Overdue__c)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── INVOICES TAB ── */}
              {activeTab === "invoices" && (
                <div>
                  <div className="relative max-w-sm mb-4">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search accounts..."
                      className="w-full pl-9 pr-9 py-2 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {filterBySearch(accounts).length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground/40">
                        <Receipt className="size-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{search ? "No matching accounts" : "No invoice data available"}</p>
                      </div>
                    ) : (
                      filterBySearch(accounts).map((account) => {
                        const invoiced = account.Bread_Winner__Total_Amount_Invoiced__c ?? 0;
                        const paid = account.Bread_Winner__Total_Amount_Paid__c ?? 0;
                        const paidPct = invoiced > 0 ? (paid / invoiced) * 100 : 0;

                        return (
                          <div key={account.Id} className="p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <p className="text-sm font-semibold truncate">{account.Name}</p>
                              <p className="text-sm font-bold tabular-nums shrink-0">{formatCurrencyPrecise(invoiced)}</p>
                            </div>
                            <PaymentProgressBar percentage={paidPct} />
                            <div className="flex items-center gap-4 mt-2 text-[10px] font-medium">
                              <span className="text-emerald-500">Paid: {formatCurrency(paid)}</span>
                              <span className="text-amber-400">Due: {formatCurrency(account.Bread_Winner__Total_Amount_Due__c)}</span>
                              {(account.Bread_Winner__Total_Amount_Overdue__c ?? 0) > 0 && (
                                <span className="text-red-400">Overdue: {formatCurrency(account.Bread_Winner__Total_Amount_Overdue__c)}</span>
                              )}
                              {(account.Bread_Winner__Total_Draft_Amount__c ?? 0) > 0 && (
                                <span className="text-blue-400">Draft: {formatCurrency(account.Bread_Winner__Total_Draft_Amount__c)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ── OVERDUE TAB ── */}
              {activeTab === "overdue" && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Warning className="size-5 text-red-400" weight="fill" />
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                      Overdue Accounts ({overdueAccounts.length})
                    </h2>
                  </div>

                  {overdueAccounts.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <CheckCircle className="size-12 mx-auto mb-3 opacity-30" />
                      <p className="text-lg font-medium">All clear!</p>
                      <p className="text-sm mt-1">No overdue invoices</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {overdueAccounts.map((account) => (
                        <div key={account.Id} className="p-4 rounded-xl bg-card border border-red-500/20 hover:border-red-500/40 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{account.Name}</p>
                              <div className="flex items-center gap-3 mt-1 text-[10px] font-medium">
                                <span className="text-muted-foreground">
                                  Total invoiced: {formatCurrency(account.Bread_Winner__Total_Amount_Invoiced__c)}
                                </span>
                                <span className="text-emerald-500">
                                  Paid: {formatCurrency(account.Bread_Winner__Total_Amount_Paid__c)}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-bold text-red-400 tabular-nums">
                                {formatCurrencyPrecise(account.Bread_Winner__Total_Amount_Overdue__c)}
                              </p>
                              <p className="text-[10px] font-semibold text-red-400/60 uppercase tracking-wider">Overdue</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── CREDITS TAB ── */}
              {activeTab === "credits" && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="size-5 text-violet-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                      Accounts with Unallocated Credit ({creditAccounts.length})
                    </h2>
                  </div>

                  {creditAccounts.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <CreditCard className="size-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No accounts with unallocated credit</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {creditAccounts.map((account) => (
                        <div key={account.Id} className="p-4 rounded-xl bg-card border border-violet-500/20 hover:border-violet-500/40 transition-colors">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{account.Name}</p>
                              <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                                Total invoiced: {formatCurrency(account.Bread_Winner__Total_Amount_Invoiced__c)} &middot; Paid: {formatCurrency(account.Bread_Winner__Total_Amount_Paid__c)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-bold text-violet-400 tabular-nums">
                                {formatCurrencyPrecise(account.Bread_Winner__Total_Unallocated_Credit__c)}
                              </p>
                              <p className="text-[10px] font-semibold text-violet-400/60 uppercase tracking-wider">Credit</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── PAYMENT PLANS TAB ── */}
              {activeTab === "payments" && (
                <div>
                  <div className="relative max-w-sm mb-4">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search deals..."
                      className="w-full pl-9 pr-9 py-2 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  {paymentPlans.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/40">
                      <Bank className="size-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No active payment plans</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {paymentPlans
                        .filter(p => !search || p.Name.toLowerCase().includes(search.toLowerCase()) || p.Account?.Name?.toLowerCase().includes(search.toLowerCase()))
                        .map((plan) => {
                          const gross = plan.Gross_Amount__c ?? plan.Amount ?? 0;
                          const paid = plan.Total_Amount_Paid__c ?? 0;
                          const balance = plan.Total_Balance__c ?? 0;
                          const pct = plan.Percentage_Paid__c ?? (gross > 0 ? (paid / gross) * 100 : 0);

                          return (
                            <div key={plan.Id} className="p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">{plan.Name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {plan.Account?.Name && (
                                      <span className="text-xs text-muted-foreground">{plan.Account.Name}</span>
                                    )}
                                    {plan.Event__r?.Name && (
                                      <>
                                        <span className="text-muted-foreground/30">&middot;</span>
                                        <span className="text-xs text-muted-foreground">{plan.Event__r.Name}</span>
                                      </>
                                    )}
                                    {plan.Owner?.Name && (
                                      <>
                                        <span className="text-muted-foreground/30">&middot;</span>
                                        <span className="text-xs text-muted-foreground">{plan.Owner.Name}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold tabular-nums">{formatCurrency(gross)}</p>
                                  <p className="text-[10px] text-amber-400 font-medium">
                                    Balance: {formatCurrencyPrecise(balance)}
                                  </p>
                                </div>
                              </div>
                              <PaymentProgressBar percentage={pct} />
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] font-medium text-muted-foreground/60">
                                <span className="text-emerald-500">Paid: {formatCurrency(paid)}</span>
                                <span>{plan.StageName}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
