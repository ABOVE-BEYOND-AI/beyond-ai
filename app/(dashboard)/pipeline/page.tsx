"use client";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Funnel,
  ArrowsClockwise,
  Users,
  Trophy,
  XCircle,
  CaretDown,
  User,
  CalendarBlank,
  Warning,
  Package,
  CheckCircle,
  X,
  CaretRight,
  ArrowRight,
  SortAscending,
} from "@phosphor-icons/react";
import type { SalesforceOpportunityFull } from "@/lib/salesforce-types";
import {
  PIPELINE_STAGES,
  WON_STAGES,
  LOST_STAGES,
  OPPORTUNITY_STAGES,
  EVENT_CATEGORY_COLORS,
  formatCurrency,
  daysSince,
} from "@/lib/constants";

// ── Types ──

type PipelineStage = (typeof PIPELINE_STAGES)[number];
type SortOption = "modified" | "amount" | "stale" | "event_date" | "payment";

interface ColumnDef {
  stage: PipelineStage;
  label: string;
}

const COLUMNS: ColumnDef[] = [
  { stage: "New", label: "New" },
  { stage: "Deposit Taken", label: "Deposit Taken" },
  { stage: "Agreement Sent", label: "Agreement Sent" },
];

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "modified", label: "Last Modified" },
  { key: "amount", label: "Highest Value" },
  { key: "stale", label: "Most Stale" },
  { key: "event_date", label: "Event Date" },
  { key: "payment", label: "Payment %" },
];

const POLL_INTERVAL_MS = 60_000;

// ── Helpers ──

function getCategoryColors(category: string | undefined | null): {
  bg: string;
  text: string;
} {
  if (!category) return { bg: "bg-muted/60", text: "text-muted-foreground" };
  const key = category.toLowerCase().replace(/\s+/g, "-");
  return (
    EVENT_CATEGORY_COLORS[key] || {
      bg: "bg-muted/60",
      text: "text-muted-foreground",
    }
  );
}

function healthColor(days: number): {
  dot: string;
  label: string;
  bg: string;
} {
  if (days <= 7) return { dot: "bg-green-500", label: "Healthy", bg: "bg-green-500/10" };
  if (days <= 14) return { dot: "bg-amber-500", label: "Aging", bg: "bg-amber-500/10" };
  return { dot: "bg-red-500", label: "Stale", bg: "bg-red-500/10" };
}

function sumAmount(opps: SalesforceOpportunityFull[]): number {
  return opps.reduce((acc, o) => acc + (o.Gross_Amount__c ?? o.Amount ?? 0), 0);
}

function weightedAmount(opps: SalesforceOpportunityFull[]): number {
  return opps.reduce((acc, o) => {
    const amount = o.Gross_Amount__c ?? o.Amount ?? 0;
    const prob = OPPORTUNITY_STAGES[o.StageName]?.probability ?? 0;
    return acc + amount * (prob / 100);
  }, 0);
}

function uniqueOwners(opps: SalesforceOpportunityFull[]): string[] {
  const names = new Set<string>();
  for (const o of opps) {
    if (o.Owner?.Name) names.add(o.Owner.Name);
  }
  return Array.from(names).sort();
}

function uniqueEvents(opps: SalesforceOpportunityFull[]): { name: string; id: string }[] {
  const map = new Map<string, string>();
  for (const o of opps) {
    if (o.Event__r?.Name && o.Event__c) {
      map.set(o.Event__c, o.Event__r.Name);
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function uniqueCategories(opps: SalesforceOpportunityFull[]): string[] {
  const cats = new Set<string>();
  for (const o of opps) {
    if (o.Event__r?.Category__c) cats.add(o.Event__r.Category__c);
  }
  return Array.from(cats).sort();
}

function sortOpps(opps: SalesforceOpportunityFull[], sort: SortOption): SalesforceOpportunityFull[] {
  const sorted = [...opps];
  switch (sort) {
    case "amount":
      return sorted.sort((a, b) => (b.Gross_Amount__c ?? b.Amount ?? 0) - (a.Gross_Amount__c ?? a.Amount ?? 0));
    case "stale":
      return sorted.sort((a, b) => daysSince(a.LastModifiedDate) - daysSince(b.LastModifiedDate)).reverse();
    case "event_date":
      return sorted.sort((a, b) => {
        const da = a.Event__r?.Start_Date__c || "9999";
        const db = b.Event__r?.Start_Date__c || "9999";
        return da.localeCompare(db);
      });
    case "payment":
      return sorted.sort((a, b) => (a.Percentage_Paid__c ?? 0) - (b.Percentage_Paid__c ?? 0));
    default:
      return sorted.sort((a, b) => new Date(b.LastModifiedDate).getTime() - new Date(a.LastModifiedDate).getTime());
  }
}

// ── Kanban Card ──

function KanbanCard({
  opp,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  opp: SalesforceOpportunityFull;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onClick: (opp: SalesforceOpportunityFull) => void;
}) {
  const amount = opp.Gross_Amount__c ?? opp.Amount ?? 0;
  const paidPct = opp.Percentage_Paid__c ?? 0;
  const days = daysSince(opp.LastModifiedDate);
  const health = healthColor(days);
  const catColors = getCategoryColors(opp.Event__r?.Category__c);
  const contactName = opp.Opportunity_Contact__r?.Name ?? opp.Account?.Name ?? "Unknown";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, opp.Id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(opp)}
      className="group cursor-grab active:cursor-grabbing rounded-lg border border-border bg-card p-3 hover:border-foreground/20 shadow-sm hover:shadow-md transition-all duration-200 relative"
    >
      {/* New Business badge */}
      {opp.Is_New_Business__c && (
        <div className="absolute -top-1.5 -right-1.5 bg-foreground text-background text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md shadow-sm">
          New
        </div>
      )}

      {/* Top: Event name + category badge */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-semibold text-foreground leading-tight truncate flex-1">
          {opp.Event__r?.Name ?? opp.Name}
        </p>
        {opp.Event__r?.Category__c && (
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${catColors.bg} ${catColors.text}`}>
            {opp.Event__r.Category__c}
          </span>
        )}
      </div>

      {/* Package name */}
      {opp.Package_Sold__r?.Name && (
        <div className="flex items-center gap-1 mb-1.5">
          <Package className="size-3 text-muted-foreground/50" weight="duotone" />
          <span className="text-[10px] font-medium text-muted-foreground/70 truncate">
            {opp.Package_Sold__r.Name}
          </span>
        </div>
      )}

      {/* Contact / Account */}
      <div className="flex items-center gap-1.5 mb-2">
        <User className="size-3.5 text-muted-foreground/60" weight="fill" />
        <span className="text-xs font-medium text-muted-foreground truncate">
          {contactName}
        </span>
      </div>

      {/* Amount + Guests row */}
      <div className="flex items-center justify-between mb-2.5 bg-muted/30 rounded-md p-1.5">
        <span className="text-sm font-bold tabular-nums text-foreground">
          {formatCurrency(amount)}
        </span>
        <div className="flex items-center gap-2">
          {opp.Total_Number_of_Guests__c != null && opp.Total_Number_of_Guests__c > 0 && (
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="size-3.5" weight="fill" />
              {opp.Total_Number_of_Guests__c}
            </span>
          )}
          {/* Sign request status for Agreement Sent stage */}
          {opp.StageName === "Agreement Sent" && (
            <span title={opp.Sign_Request_Complete__c ? "Agreement signed" : "Awaiting signature"}>
              <CheckCircle
                className={`size-3.5 ${opp.Sign_Request_Complete__c ? "text-emerald-500" : "text-muted-foreground/30"}`}
                weight={opp.Sign_Request_Complete__c ? "fill" : "regular"}
              />
            </span>
          )}
        </div>
      </div>

      {/* Payment progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Paid
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold tabular-nums">
            {Math.round(paidPct)}%
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              paidPct >= 100
                ? "bg-emerald-500"
                : paidPct >= 50
                  ? "bg-blue-500"
                  : paidPct > 0
                    ? "bg-amber-500"
                    : "bg-muted-foreground/30"
            }`}
            style={{ width: `${Math.min(paidPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Days in stage + event date */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${health.dot}`} title={health.label} />
          <span className="text-[10px] font-medium text-muted-foreground">
            {days}d in stage
          </span>
        </div>
        {opp.Event__r?.Start_Date__c && (
          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            <CalendarBlank className="size-3" weight="bold" />
            {new Date(opp.Event__r.Start_Date__c).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>

      {/* Next step */}
      {opp.NextStep && (
        <p className="text-[11px] text-muted-foreground/80 font-medium truncate mb-1.5">
          Next: {opp.NextStep}
        </p>
      )}

      {/* Owner */}
      {opp.Owner?.Name && (
        <p className="text-[10px] font-medium text-muted-foreground/50 truncate">
          {opp.Owner.Name}
        </p>
      )}
    </motion.div>
  );
}

// ── Stat Card ──

function StatCard({
  label,
  count,
  value,
  weighted,
  delay,
}: {
  label: string;
  count: number;
  value: number;
  weighted?: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-3xl font-black tabular-nums text-foreground tracking-tight">
        {formatCurrency(value)}
      </p>
      <div className="flex items-center gap-3 mt-1">
        <p className="text-sm font-semibold text-muted-foreground">
          {count} deal{count !== 1 ? "s" : ""}
        </p>
        {weighted !== undefined && weighted !== value && (
          <p className="text-xs font-medium text-muted-foreground/50" title="Weighted pipeline value (amount × probability)">
            ~{formatCurrency(weighted)} weighted
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Filter Select ──

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-card/60 border border-border/50 rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ── Deal Drawer ──

function DealDrawer({
  opp,
  onClose,
}: {
  opp: SalesforceOpportunityFull;
  onClose: () => void;
}) {
  const amount = opp.Gross_Amount__c ?? opp.Amount ?? 0;
  const netAmount = opp.Amount ?? 0;
  const paidPct = opp.Percentage_Paid__c ?? 0;
  const days = daysSince(opp.LastModifiedDate);
  const health = healthColor(days);
  const catColors = getCategoryColors(opp.Event__r?.Category__c);
  const contactName = opp.Opportunity_Contact__r?.Name ?? opp.Account?.Name ?? "Unknown";
  const stageConfig = OPPORTUNITY_STAGES[opp.StageName];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-[480px] bg-card border-l border-border shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {opp.Is_New_Business__c && (
                <span className="bg-foreground text-background text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">
                  New Biz
                </span>
              )}
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${stageConfig?.color}20`,
                  color: stageConfig?.color,
                }}
              >
                {opp.StageName}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground tracking-tight truncate">
              {opp.Event__r?.Name ?? opp.Name}
            </h2>
            <p className="text-sm text-muted-foreground truncate">{contactName}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Close drawer"
          >
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Financial Overview */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Financial
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Gross Amount</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(amount)}</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Net Amount</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(netAmount)}</p>
              </div>
              {opp.Service_Charge__c != null && (
                <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Service Charge</p>
                  <p className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(opp.Service_Charge__c)}</p>
                </div>
              )}
              {opp.Commission_Amount__c != null && (
                <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Commission</p>
                  <p className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(opp.Commission_Amount__c)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Progress */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Payment Progress
            </h3>
            <div className="bg-muted/20 rounded-lg p-4 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">{Math.round(paidPct)}% Paid</span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {formatCurrency(opp.Total_Amount_Paid__c ?? 0)} / {formatCurrency(amount)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-border overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    paidPct >= 100 ? "bg-emerald-500" : paidPct >= 50 ? "bg-blue-500" : paidPct > 0 ? "bg-amber-500" : "bg-muted-foreground/30"
                  }`}
                  style={{ width: `${Math.min(paidPct, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Outstanding</p>
                  <p className="font-semibold text-foreground tabular-nums">{formatCurrency(opp.Total_Balance__c ?? 0)}</p>
                </div>
                {opp.Total_Payments_Due__c != null && (
                  <div>
                    <p className="text-muted-foreground">Payments Due</p>
                    <p className="font-semibold text-foreground tabular-nums">{formatCurrency(opp.Total_Payments_Due__c)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deal Details */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Details
            </h3>
            <div className="space-y-2.5">
              {opp.Event__r?.Category__c && (
                <DetailRow label="Category">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${catColors.bg} ${catColors.text}`}>
                    {opp.Event__r.Category__c}
                  </span>
                </DetailRow>
              )}
              {opp.Package_Sold__r?.Name && (
                <DetailRow label="Package">{opp.Package_Sold__r.Name}</DetailRow>
              )}
              {opp.Total_Number_of_Guests__c != null && opp.Total_Number_of_Guests__c > 0 && (
                <DetailRow label="Guests">{opp.Total_Number_of_Guests__c}</DetailRow>
              )}
              {opp.Event__r?.Start_Date__c && (
                <DetailRow label="Event Date">
                  {new Date(opp.Event__r.Start_Date__c).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </DetailRow>
              )}
              <DetailRow label="Lead Source">{opp.LeadSource ?? "—"}</DetailRow>
              <DetailRow label="Owner">{opp.Owner?.Name ?? "—"}</DetailRow>
              {opp.StageName === "Agreement Sent" && (
                <DetailRow label="Signature">
                  <span className={`flex items-center gap-1.5 ${opp.Sign_Request_Complete__c ? "text-emerald-500" : "text-amber-500"}`}>
                    <CheckCircle className="size-3.5" weight={opp.Sign_Request_Complete__c ? "fill" : "regular"} />
                    {opp.Sign_Request_Complete__c ? "Signed" : "Awaiting"}
                  </span>
                </DetailRow>
              )}
              {opp.Loss_Reason__c && (
                <DetailRow label="Loss Reason">
                  <span className="text-red-400">{opp.Loss_Reason__c}</span>
                </DetailRow>
              )}
            </div>
          </div>

          {/* Health & Activity */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Activity
            </h3>
            <div className="space-y-2.5">
              <DetailRow label="Days in Stage">
                <span className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${health.dot}`} />
                  {days} days ({health.label})
                </span>
              </DetailRow>
              <DetailRow label="Created">
                {new Date(opp.CreatedDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </DetailRow>
              <DetailRow label="Last Modified">
                {new Date(opp.LastModifiedDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </DetailRow>
              {opp.LastActivityDate && (
                <DetailRow label="Last Activity">
                  {new Date(opp.LastActivityDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </DetailRow>
              )}
            </div>
          </div>

          {/* Next Step & Special Requirements */}
          {(opp.NextStep || opp.Special_Requirements__c) && (
            <div>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Notes
              </h3>
              {opp.NextStep && (
                <div className="bg-muted/20 rounded-lg p-3 border border-border/50 mb-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Next Step</p>
                  <p className="text-sm text-foreground">{opp.NextStep}</p>
                </div>
              )}
              {opp.Special_Requirements__c && (
                <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Special Requirements</p>
                  <p className="text-sm text-foreground">{opp.Special_Requirements__c}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{children}</span>
    </div>
  );
}

// ── Stale Deals Alert ──

function StaleAlert({
  count,
  totalValue,
  onClick,
}: {
  count: number;
  totalValue: number;
  onClick: () => void;
}) {
  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="mb-4"
    >
      <button
        onClick={onClick}
        className="w-full text-left rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3.5 hover:bg-red-500/[0.07] transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Warning className="size-4 text-red-500" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {count} deal{count !== 1 ? "s" : ""} need attention
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalValue)} at risk — no activity for 14+ days
              </p>
            </div>
          </div>
          <CaretRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </button>
    </motion.div>
  );
}

// ── Funnel Metrics ──

function FunnelMetrics({
  newCount,
  depositCount,
  agreementCount,
  wonCount,
  lostCount,
  totalCycleTime,
}: {
  newCount: number;
  depositCount: number;
  agreementCount: number;
  wonCount: number;
  lostCount: number;
  totalCycleTime: number;
}) {
  const totalDeals = newCount + depositCount + agreementCount + wonCount + lostCount;
  const winRate = totalDeals > 0 ? (wonCount / totalDeals) * 100 : 0;
  const newToDeposit = newCount + depositCount + agreementCount + wonCount > 0
    ? ((depositCount + agreementCount + wonCount) / (newCount + depositCount + agreementCount + wonCount)) * 100
    : 0;
  const depositToAgreement = depositCount + agreementCount + wonCount > 0
    ? ((agreementCount + wonCount) / (depositCount + agreementCount + wonCount)) * 100
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
        Conversion Funnel
      </h3>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">New</span>
            <ArrowRight className="size-3 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">Deposit</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{Math.round(newToDeposit)}%</p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Deposit</span>
            <ArrowRight className="size-3 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">Agreement</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{Math.round(depositToAgreement)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-500">{Math.round(winRate)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Avg. Cycle</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{Math.round(totalCycleTime)}d</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Component ──

export default function PipelinePage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [opportunities, setOpportunities] = useState<SalesforceOpportunityFull[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [ownerFilter, setOwnerFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("modified");

  // UI State
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<SalesforceOpportunityFull | null>(null);
  const [wonExpanded, setWonExpanded] = useState(false);
  const [lostExpanded, setLostExpanded] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedOnce = useRef(false);

  // ── Auth redirect ──
  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // ── Fetch data ──
  const fetchData = useCallback(async (silent = false) => {
    if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
    if (silent) setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/pipeline?includeClosed=true");
      if (!response.ok) throw new Error("Failed to fetch pipeline");
      const result = await response.json();
      if (result.success) {
        setOpportunities(result.data);
        setLastUpdated(new Date());
        hasFetchedOnce.current = true;
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (err) {
      console.error("Pipeline fetch error:", err);
      if (!hasFetchedOnce.current)
        setError("Failed to load pipeline data. Check Salesforce connection.");
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData(hasFetchedOnce.current);
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, fetchData]);

  // ── Drag and Drop ──
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, newStage: string) => {
      e.preventDefault();
      const oppId = e.dataTransfer.getData("text/plain");
      setDragOverColumn(null);

      if (!oppId) return;
      const opp = opportunities.find((o) => o.Id === oppId);
      if (!opp || opp.StageName === newStage) return;

      // Optimistic update
      setOpportunities((prev) =>
        prev.map((o) =>
          o.Id === oppId
            ? { ...o, StageName: newStage, LastModifiedDate: new Date().toISOString() }
            : o
        )
      );

      try {
        const res = await fetch("/api/pipeline", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: oppId, stage: newStage }),
        });
        if (!res.ok) {
          setOpportunities((prev) =>
            prev.map((o) =>
              o.Id === oppId ? { ...o, StageName: opp.StageName, LastModifiedDate: opp.LastModifiedDate } : o
            )
          );
        }
      } catch {
        setOpportunities((prev) =>
          prev.map((o) =>
            o.Id === oppId ? { ...o, StageName: opp.StageName, LastModifiedDate: opp.LastModifiedDate } : o
          )
        );
      }
    },
    [opportunities]
  );

  const handleDragEnd = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  // ── Derived data ──
  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (ownerFilter && o.Owner?.Name !== ownerFilter) return false;
      if (eventFilter && o.Event__c !== eventFilter) return false;
      if (categoryFilter && o.Event__r?.Category__c !== categoryFilter) return false;
      return true;
    });
  }, [opportunities, ownerFilter, eventFilter, categoryFilter]);

  const columns: Record<PipelineStage, SalesforceOpportunityFull[]> = useMemo(() => ({
    New: sortOpps(filtered.filter((o) => o.StageName === "New"), sortBy),
    "Deposit Taken": sortOpps(filtered.filter((o) => o.StageName === "Deposit Taken"), sortBy),
    "Agreement Sent": sortOpps(filtered.filter((o) => o.StageName === "Agreement Sent"), sortBy),
  }), [filtered, sortBy]);

  const wonDeals = useMemo(
    () => filtered.filter((o) => (WON_STAGES as readonly string[]).includes(o.StageName)),
    [filtered]
  );
  const lostDeals = useMemo(
    () => filtered.filter((o) => (LOST_STAGES as readonly string[]).includes(o.StageName)),
    [filtered]
  );

  const totalPipeline = useMemo(
    () => [...columns["New"], ...columns["Deposit Taken"], ...columns["Agreement Sent"]],
    [columns]
  );

  // Stale deals (14+ days without activity) in open pipeline only
  const staleDeals = useMemo(
    () => totalPipeline.filter((o) => daysSince(o.LastModifiedDate) >= 14),
    [totalPipeline]
  );

  const owners = useMemo(() => uniqueOwners(opportunities), [opportunities]);
  const events = useMemo(() => uniqueEvents(opportunities), [opportunities]);
  const categories = useMemo(() => uniqueCategories(opportunities), [opportunities]);

  // Average deal cycle for won deals
  const avgCycleTime = useMemo(() => {
    if (wonDeals.length === 0) return 0;
    const total = wonDeals.reduce((acc, o) => {
      const created = new Date(o.CreatedDate).getTime();
      const modified = new Date(o.LastModifiedDate).getTime();
      return acc + (modified - created) / 86400000;
    }, 0);
    return total / wonDeals.length;
  }, [wonDeals]);

  // ── Loading ──
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
    <div className="min-h-dvh bg-background p-6 pl-24 lg:p-8 lg:pl-32">
      <div className="max-w-[1600px] mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalPipeline.length} open deal{totalPipeline.length !== 1 ? "s" : ""} &middot; {formatCurrency(sumAmount(totalPipeline))} total
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filters */}
            <FilterSelect
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={owners.map((name) => ({ value: name, label: name }))}
              placeholder="All Owners"
            />
            <FilterSelect
              value={eventFilter}
              onChange={setEventFilter}
              options={events.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="All Events"
            />
            <FilterSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categories.map((c) => ({ value: c, label: c }))}
              placeholder="All Categories"
            />

            {/* Sort */}
            <div className="relative">
              <SortAscending className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none bg-card/60 border border-border/50 rounded-lg pl-8 pr-8 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {(ownerFilter || eventFilter || categoryFilter) && (
              <button
                onClick={() => {
                  setOwnerFilter("");
                  setEventFilter("");
                  setCategoryFilter("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Clear filters
              </button>
            )}

            {/* Refresh */}
            <div className="flex items-center gap-2 pl-2 border-l border-border/30">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground/50">
                  {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="text-muted-foreground/50 hover:text-foreground transition-colors"
                aria-label="Refresh pipeline"
              >
                <ArrowsClockwise className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Error ── */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={() => fetchData()} className="mt-1 text-sm text-red-400/80 hover:text-red-400 underline">
                Try again
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Stale Deals Alert ── */}
        {!initialLoading && (
          <StaleAlert
            count={staleDeals.length}
            totalValue={sumAmount(staleDeals)}
            onClick={() => setSortBy("stale")}
          />
        )}

        {/* ── Pipeline Summary ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            label="New"
            count={columns["New"].length}
            value={sumAmount(columns["New"])}
            delay={0.05}
          />
          <StatCard
            label="Deposit Taken"
            count={columns["Deposit Taken"].length}
            value={sumAmount(columns["Deposit Taken"])}
            delay={0.1}
          />
          <StatCard
            label="Agreement Sent"
            count={columns["Agreement Sent"].length}
            value={sumAmount(columns["Agreement Sent"])}
            delay={0.15}
          />
          <StatCard
            label="Total Pipeline"
            count={totalPipeline.length}
            value={sumAmount(totalPipeline)}
            weighted={weightedAmount(totalPipeline)}
            delay={0.2}
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Weighted Forecast
              </span>
            </div>
            <p className="text-3xl font-black tabular-nums text-foreground tracking-tight">
              {formatCurrency(weightedAmount(totalPipeline))}
            </p>
            <p className="text-xs font-medium text-muted-foreground/50 mt-1" title="Sum of (deal value × stage probability)">
              Amount × probability
            </p>
          </motion.div>
        </div>

        {/* ── Kanban Board ── */}
        {initialLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((col) => (
              <div key={col} className="rounded-lg border border-border bg-card p-4">
                <div className="animate-pulse bg-muted h-6 w-32 rounded mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-muted h-36 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {COLUMNS.map((col) => {
              const stageOpps = columns[col.stage];
              const stageTotal = sumAmount(stageOpps);
              const isOver = dragOverColumn === col.stage;
              const stageConfig = OPPORTUNITY_STAGES[col.stage];

              return (
                <div
                  key={col.stage}
                  onDragOver={(e) => handleDragOver(e, col.stage)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.stage)}
                  className={`rounded-lg border transition-all duration-200 flex flex-col h-full ${
                    isOver ? "ring-2 ring-primary border-primary" : "border-border bg-muted/10 hover:bg-muted/20"
                  }`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: stageConfig?.color || "#888" }}
                      />
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                        {col.label}
                      </h3>
                      <span className="text-xs font-semibold text-muted-foreground bg-background border border-border px-2 py-0.5 rounded-md tabular-nums">
                        {stageOpps.length}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {formatCurrency(stageTotal)}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="p-3 space-y-3 flex-1 min-h-[300px] overflow-y-auto scrollbar-hide">
                    <AnimatePresence mode="popLayout">
                      {stageOpps.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center py-12 text-muted-foreground/40"
                        >
                          <Funnel className="size-8 mb-2" />
                          <p className="text-xs">No deals</p>
                        </motion.div>
                      ) : (
                        stageOpps.map((opp) => (
                          <KanbanCard
                            key={opp.Id}
                            opp={opp}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onClick={setSelectedOpp}
                          />
                        ))
                      )}
                    </AnimatePresence>

                    {isOver && (
                      <div className="border-2 border-dashed border-primary/40 rounded-lg h-24 flex items-center justify-center bg-primary/5">
                        <span className="text-sm font-bold text-primary/60 uppercase tracking-wider">
                          Drop deal here
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Funnel Metrics ── */}
        {!initialLoading && (
          <div className="mb-8">
            <FunnelMetrics
              newCount={columns["New"].length}
              depositCount={columns["Deposit Taken"].length}
              agreementCount={columns["Agreement Sent"].length}
              wonCount={wonDeals.length}
              lostCount={lostDeals.length}
              totalCycleTime={avgCycleTime}
            />
          </div>
        )}

        {/* ── Won & Lost Panels ── */}
        {!initialLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Won panel */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
              <button
                onClick={() => setWonExpanded(!wonExpanded)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Trophy className="size-5 text-emerald-500" weight="fill" />
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider">
                      Won Deals
                    </h3>
                  </div>
                  <CaretDown
                    className={`size-4 text-emerald-500/50 transition-transform duration-200 ${wonExpanded ? "rotate-180" : ""}`}
                  />
                </div>
                <div className="flex items-baseline gap-4">
                  <p className="text-3xl font-bold tabular-nums text-emerald-500">
                    {formatCurrency(sumAmount(wonDeals))}
                  </p>
                  <p className="text-sm font-medium text-emerald-500/60">
                    {wonDeals.length} deal{wonDeals.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>
              {wonDeals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(WON_STAGES as readonly string[]).map((stage) => {
                    const count = wonDeals.filter((o) => o.StageName === stage).length;
                    if (count === 0) return null;
                    return (
                      <span key={stage} className="text-[10px] font-medium text-emerald-500/70 bg-emerald-500/10 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                        {stage}: {count}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Expanded deal list */}
              <AnimatePresence>
                {wonExpanded && wonDeals.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-2 border-t border-emerald-500/10 pt-4">
                      {wonDeals.slice(0, 20).map((opp) => (
                        <button
                          key={opp.Id}
                          onClick={() => setSelectedOpp(opp)}
                          className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-emerald-500/[0.06] transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {opp.Event__r?.Name ?? opp.Name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {opp.Opportunity_Contact__r?.Name ?? opp.Account?.Name} &middot; {opp.Owner?.Name}
                            </p>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-emerald-500 shrink-0 ml-3">
                            {formatCurrency(opp.Gross_Amount__c ?? opp.Amount ?? 0)}
                          </span>
                        </button>
                      ))}
                      {wonDeals.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          + {wonDeals.length - 20} more
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Lost panel */}
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-5">
              <button
                onClick={() => setLostExpanded(!lostExpanded)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <XCircle className="size-5 text-red-500" weight="fill" />
                    <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider">
                      Lost Deals
                    </h3>
                  </div>
                  <CaretDown
                    className={`size-4 text-red-500/50 transition-transform duration-200 ${lostExpanded ? "rotate-180" : ""}`}
                  />
                </div>
                <div className="flex items-baseline gap-4">
                  <p className="text-3xl font-bold tabular-nums text-red-500">
                    {formatCurrency(sumAmount(lostDeals))}
                  </p>
                  <p className="text-sm font-medium text-red-500/60">
                    {lostDeals.length} deal{lostDeals.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>
              {lostDeals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(LOST_STAGES as readonly string[]).map((stage) => {
                    const count = lostDeals.filter((o) => o.StageName === stage).length;
                    if (count === 0) return null;
                    return (
                      <span key={stage} className="text-[10px] font-medium text-red-500/70 bg-red-500/10 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                        {stage}: {count}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Expanded deal list with loss reasons */}
              <AnimatePresence>
                {lostExpanded && lostDeals.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-2 border-t border-red-500/10 pt-4">
                      {lostDeals.slice(0, 20).map((opp) => (
                        <button
                          key={opp.Id}
                          onClick={() => setSelectedOpp(opp)}
                          className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-red-500/[0.06] transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {opp.Event__r?.Name ?? opp.Name}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground truncate">
                                {opp.Opportunity_Contact__r?.Name ?? opp.Account?.Name}
                              </p>
                              {opp.Loss_Reason__c && (
                                <>
                                  <span className="text-muted-foreground/30">&middot;</span>
                                  <p className="text-xs text-red-400/70 truncate">{opp.Loss_Reason__c}</p>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-red-500 shrink-0 ml-3">
                            {formatCurrency(opp.Gross_Amount__c ?? opp.Amount ?? 0)}
                          </span>
                        </button>
                      ))}
                      {lostDeals.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          + {lostDeals.length - 20} more
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Deal Drawer ── */}
      <AnimatePresence>
        {selectedOpp && (
          <DealDrawer opp={selectedOpp} onClose={() => setSelectedOpp(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
