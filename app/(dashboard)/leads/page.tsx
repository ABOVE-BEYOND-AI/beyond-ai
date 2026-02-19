"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  MagnifyingGlass,
  FunnelSimple,
  CaretDown,
  CaretUpDown,
  Fire,
  PhoneCall,
  Sparkle,
  Snowflake,
  CalendarBlank,
  Prohibit,
  X,
  NotePencil,
  Check,
  EnvelopeSimple,
  Phone,
  LinkedinLogo,
  Globe,
  User,
  Buildings,
  Tag,
  ArrowsClockwise,
  CaretRight,
  Users,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { SalesforceLead } from "@/lib/salesforce-types";
import {
  calculateLeadScore,
  getScoreColor,
  getScoreBgColor,
} from "@/lib/lead-scoring";
import {
  LEAD_STATUSES,
  INTEREST_FIELDS,
  LEAD_SOURCE_GROUPS,
  formatRelativeTime,
  getSourceGroup,
} from "@/lib/constants";

// ── Types ──

type LeadView =
  | "all"
  | "hot"
  | "needCalling"
  | "newThisWeek"
  | "goingCold"
  | "eventInterested"
  | "unqualified";

type SortField = "score" | "lastActivity" | "created";
type SortDirection = "asc" | "desc";

interface ViewTab {
  key: LeadView;
  label: string;
  icon: React.ElementType;
}

// ── Constants ──

const VIEW_TABS: ViewTab[] = [
  { key: "all", label: "All Leads", icon: Users },
  { key: "hot", label: "Hot Leads", icon: Fire },
  { key: "needCalling", label: "Need Calling", icon: PhoneCall },
  { key: "newThisWeek", label: "New This Week", icon: Sparkle },
  { key: "goingCold", label: "Going Cold", icon: Snowflake },
  { key: "eventInterested", label: "Event Interested", icon: CalendarBlank },
  { key: "unqualified", label: "Unqualified", icon: Prohibit },
];

const STATUS_OPTIONS = [
  "New",
  "Working",
  "Prospect",
  "Interested",
  "Nurturing",
  "Qualified",
  "Unqualified",
];

const SOURCE_GROUP_OPTIONS = Object.keys(LEAD_SOURCE_GROUPS);

const INTEREST_OPTIONS = Object.entries(INTEREST_FIELDS).map(
  ([field, config]) => ({
    field,
    label: config.label,
  })
);

// ── Helpers ──

function getLeadInterests(
  lead: SalesforceLead
): { label: string; color: string }[] {
  const interests: { label: string; color: string }[] = [];
  for (const [field, config] of Object.entries(INTEREST_FIELDS)) {
    if (lead[field as keyof SalesforceLead]) {
      interests.push({ label: config.label, color: config.color });
    }
  }
  return interests;
}

function getStatusBadgeClass(status: string): string {
  return LEAD_STATUSES[status]?.bgColor || "bg-muted text-muted-foreground";
}

// ── Sub-components ──

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-border/30">
      <div className="animate-pulse bg-muted/50 size-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="animate-pulse bg-muted/50 h-4 w-32 rounded mb-1.5" />
        <div className="animate-pulse bg-muted/40 h-3 w-24 rounded" />
      </div>
      <div className="animate-pulse bg-muted/40 h-5 w-16 rounded-full" />
      <div className="hidden lg:block animate-pulse bg-muted/40 h-4 w-28 rounded" />
      <div className="hidden xl:flex gap-1.5">
        <div className="animate-pulse bg-muted/40 h-5 w-14 rounded-full" />
        <div className="animate-pulse bg-muted/40 h-5 w-14 rounded-full" />
      </div>
      <div className="hidden md:block animate-pulse bg-muted/40 h-4 w-20 rounded" />
      <div className="animate-pulse bg-muted/40 h-4 w-12 rounded" />
    </div>
  );
}

function StatusDropdown({
  currentStatus,
  onStatusChange,
  isOpen,
  onToggle,
}: {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onToggle();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${getStatusBadgeClass(currentStatus)}`}
      >
        {currentStatus}
        <CaretDown className="size-3 opacity-60" />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
          >
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(status);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 ${
                  status === currentStatus
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                <span
                  className={`inline-block size-2 rounded-full`}
                  style={{
                    backgroundColor: LEAD_STATUSES[status]?.color || "#888",
                  }}
                />
                {status}
                {status === currentStatus && (
                  <Check className="size-3 ml-auto text-primary" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InlineNoteInput({
  leadId,
  currentNote,
  onSave,
  onCancel,
}: {
  leadId: string;
  currentNote: string | null;
  onSave: (leadId: string, note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(currentNote || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 mt-2"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && note.trim()) onSave(leadId, note.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Add a note..."
        className="flex-1 bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      <button
        onClick={() => {
          if (note.trim()) onSave(leadId, note.trim());
        }}
        className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <Check className="size-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="p-1.5 rounded-lg bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const selectedLabel =
    options.find((o) => o.value === value)?.label || label;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
          value
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <FunnelSimple className="size-3.5" />
        {value ? selectedLabel : label}
        <CaretDown className="size-3 opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px] max-h-[240px] overflow-y-auto"
          >
            <button
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors ${
                !value
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              All {label}
            </button>
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 ${
                  opt.value === value
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {opt.label}
                {opt.value === value && (
                  <Check className="size-3 ml-auto text-primary" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LeadDetailPanel({
  lead,
  onClose,
  onStatusChange,
}: {
  lead: SalesforceLead;
  onClose: () => void;
  onStatusChange: (leadId: string, status: string) => void;
}) {
  const score = calculateLeadScore(lead);
  const interests = getLeadInterests(lead);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-background border-l border-border shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate text-foreground">{lead.Name}</h2>
              {lead.Title && (
                <p className="text-sm text-muted-foreground mt-0.5 font-medium">
                  {lead.Title}
                </p>
              )}
              {lead.Company && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                  <Buildings className="size-4" />
                  {lead.Company}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Score + Status row */}
          <div className="flex items-center gap-3 mt-4">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${getScoreBgColor(score)}`}
            >
              <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                {score}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${getScoreColor(score)} opacity-70`}
              >
                Score
              </span>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-semibold uppercase tracking-wider ${getStatusBadgeClass(lead.Status)}`}
            >
              {lead.Status}
            </span>
            {lead.Owner?.Name && (
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <User className="size-3.5" />
                {lead.Owner.Name}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-8">
          {/* Contact Info */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Contact Information
            </h3>
            <div className="space-y-3">
              {lead.Email && (
                <a
                  href={`mailto:${lead.Email}`}
                  className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary transition-colors group"
                >
                  <EnvelopeSimple className="size-4 text-muted-foreground group-hover:text-primary" />
                  {lead.Email}
                </a>
              )}
              {lead.Phone && (
                <a
                  href={`tel:${lead.Phone}`}
                  className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary transition-colors group"
                >
                  <Phone className="size-4 text-muted-foreground group-hover:text-primary" />
                  {lead.Phone}
                </a>
              )}
              {lead.MobilePhone && lead.MobilePhone !== lead.Phone && (
                <a
                  href={`tel:${lead.MobilePhone}`}
                  className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary transition-colors group"
                >
                  <Phone className="size-4 text-muted-foreground group-hover:text-primary" />
                  {lead.MobilePhone}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-2">Mobile</span>
                </a>
              )}
            </div>
          </div>

          {/* Event Interest */}
          {lead.Event_of_Interest__c && (
            <div>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Event of Interest
              </h3>
              <div className="bg-card border border-border rounded-md px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold text-foreground">{lead.Event_of_Interest__c}</p>
                {lead.No_of_Guests__c != null && lead.No_of_Guests__c > 0 && (
                  <p className="text-xs font-medium text-muted-foreground mt-1.5 flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {lead.No_of_Guests__c} guest{lead.No_of_Guests__c !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Interests */}
          {interests.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <span
                    key={interest.label}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${interest.color}15`,
                      color: interest.color,
                      border: `1px solid ${interest.color}30`
                    }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: interest.color }}
                    />
                    {interest.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Lead Details */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Lead Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/20 border border-border rounded-md px-3 py-2.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source</p>
                <p className="text-sm font-semibold mt-1 text-foreground">
                  {lead.LeadSource || "Unknown"}
                </p>
              </div>
              <div className="bg-muted/20 border border-border rounded-md px-3 py-2.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source Group</p>
                <p className="text-sm font-semibold mt-1 text-foreground">
                  {getSourceGroup(lead.LeadSource)}
                </p>
              </div>
              <div className="bg-muted/20 border border-border rounded-md px-3 py-2.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Created</p>
                <p className="text-sm font-semibold mt-1 text-foreground">
                  {new Date(lead.CreatedDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="bg-muted/20 border border-border rounded-md px-3 py-2.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Last Activity</p>
                <p className="text-sm font-semibold mt-1 text-foreground">
                  {formatRelativeTime(lead.LastActivityDate)}
                </p>
              </div>
              {lead.Rating && (
                <div className="bg-muted/20 border border-border rounded-md px-3 py-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rating</p>
                  <p className="text-sm font-semibold mt-1 text-foreground">{lead.Rating}</p>
                </div>
              )}
              {lead.Form_Type__c && (
                <div className="bg-muted/20 border border-border rounded-md px-3 py-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Form Type</p>
                  <p className="text-sm font-semibold mt-1 text-foreground">{lead.Form_Type__c}</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Comments */}
          {lead.Form_Comments__c && (
            <div>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Form Comments
              </h3>
              <div className="bg-muted/20 border border-border rounded-md px-4 py-3">
                <p className="text-sm font-medium text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {lead.Form_Comments__c}
                </p>
              </div>
            </div>
          )}

          {/* Recent Note */}
          {lead.Recent_Note__c && (
            <div>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Recent Note
              </h3>
              <div className="bg-muted/20 border border-border rounded-md px-4 py-3">
                <p className="text-sm font-medium text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {lead.Recent_Note__c}
                </p>
              </div>
            </div>
          )}

          {/* Tags */}
          {lead.Tags__c && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {lead.Tags__c.split(";").map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted/30 text-muted-foreground border border-border/30"
                  >
                    <Tag className="size-3 mr-1" />
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Social Links */}
          {(lead.LinkedIn__c || lead.Facebook__c || lead.Twitter__c) && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Social
              </h3>
              <div className="flex gap-2">
                {lead.LinkedIn__c && (
                  <a
                    href={lead.LinkedIn__c}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/20 border border-border/30 text-sm text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <LinkedinLogo className="size-4 text-[#0A66C2]" />
                    LinkedIn
                  </a>
                )}
                {lead.Facebook__c && (
                  <a
                    href={lead.Facebook__c}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/20 border border-border/30 text-sm text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Globe className="size-4 text-[#1877F2]" />
                    Facebook
                  </a>
                )}
                {lead.Twitter__c && (
                  <a
                    href={lead.Twitter__c}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/20 border border-border/30 text-sm text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Globe className="size-4 text-foreground/70" />
                    Twitter
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Consent */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Consent
            </h3>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${lead.I_agree_to_be_emailed__c ? "bg-green-500" : "bg-red-500"}`}
                />
                Agreed to emails:{" "}
                {lead.I_agree_to_be_emailed__c ? "Yes" : "No"}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${lead.HasOptedOutOfEmail ? "bg-red-500" : "bg-green-500"}`}
                />
                Opted out: {lead.HasOptedOutOfEmail ? "Yes" : "No"}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${lead.Newsletter_Subscribed__c ? "bg-green-500" : "bg-muted"}`}
                />
                Newsletter:{" "}
                {lead.Newsletter_Subscribed__c ? "Subscribed" : "Not subscribed"}
              </p>
            </div>
          </div>

          {/* Change Status */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Change Status
            </h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => onStatusChange(lead.Id, status)}
                  disabled={status === lead.Status}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    status === lead.Status
                      ? "opacity-50 cursor-not-allowed border-transparent " +
                        getStatusBadgeClass(status)
                      : "border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Main Component ──

export default function LeadsPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  // Data state
  const [leads, setLeads] = useState<SalesforceLead[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [activeView, setActiveView] = useState<LeadView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [interestFilter, setInterestFilter] = useState("");

  // Sort state
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // UI state
  const [selectedLead, setSelectedLead] = useState<SalesforceLead | null>(null);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(
    null
  );
  const [noteInputLeadId, setNoteInputLeadId] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  // Search debounce
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Fetch leads
  const fetchLeads = useCallback(
    async (silent = false) => {
      if (!silent) setDataLoading(true);
      else setIsRefreshing(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (activeView !== "all") params.set("view", activeView);
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (statusFilter) params.set("status", statusFilter);
        if (sourceFilter) params.set("sourceGroup", sourceFilter);
        if (interestFilter) params.set("interest", interestFilter);

        const res = await fetch(`/api/leads?${params}`);
        if (!res.ok) throw new Error("Failed to fetch leads");
        const data = await res.json();
        if (data.success) {
          setLeads(data.data);
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } catch (err) {
        console.error("Error fetching leads:", err);
        setError("Failed to load leads. Check Salesforce connection.");
      } finally {
        setDataLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeView, debouncedSearch, statusFilter, sourceFilter, interestFilter]
  );

  useEffect(() => {
    if (user) fetchLeads();
  }, [user, fetchLeads]);

  // Sort leads client-side
  const sortedLeads = useMemo(() => {
    const sorted = [...leads].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortField) {
        case "score":
          aVal = calculateLeadScore(a);
          bVal = calculateLeadScore(b);
          break;
        case "lastActivity":
          aVal = a.LastActivityDate
            ? new Date(a.LastActivityDate).getTime()
            : 0;
          bVal = b.LastActivityDate
            ? new Date(b.LastActivityDate).getTime()
            : 0;
          break;
        case "created":
          aVal = new Date(a.CreatedDate).getTime();
          bVal = new Date(b.CreatedDate).getTime();
          break;
        default:
          return 0;
      }

      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [leads, sortField, sortDirection]);

  // Status update
  const updateStatus = useCallback(
    async (leadId: string, newStatus: string) => {
      setUpdatingLeadId(leadId);
      setOpenStatusDropdown(null);
      try {
        await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: leadId, fields: { Status: newStatus } }),
        });
        // Optimistic update
        setLeads((prev) =>
          prev.map((l) =>
            l.Id === leadId ? { ...l, Status: newStatus } : l
          )
        );
        // Also update selected lead if open
        if (selectedLead?.Id === leadId) {
          setSelectedLead((prev) =>
            prev ? { ...prev, Status: newStatus } : null
          );
        }
      } catch (err) {
        console.error("Failed to update status:", err);
      } finally {
        setUpdatingLeadId(null);
      }
    },
    [selectedLead]
  );

  // Note save
  const saveNote = useCallback(
    async (leadId: string, note: string) => {
      setNoteInputLeadId(null);
      try {
        await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: leadId,
            fields: { Recent_Note__c: note },
          }),
        });
        setLeads((prev) =>
          prev.map((l) =>
            l.Id === leadId ? { ...l, Recent_Note__c: note } : l
          )
        );
        if (selectedLead?.Id === leadId) {
          setSelectedLead((prev) =>
            prev ? { ...prev, Recent_Note__c: note } : null
          );
        }
      } catch (err) {
        console.error("Failed to save note:", err);
      }
    },
    [selectedLead]
  );

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setSourceFilter("");
    setInterestFilter("");
    setActiveView("all");
  };

  const hasActiveFilters =
    statusFilter || sourceFilter || interestFilter || searchQuery;

  // ── Loading guard ──

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Title row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
                {!dataLoading && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary"
                  >
                    {sortedLeads.length}
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchLeads(true)}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <ArrowsClockwise
                    className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads by name, company, or email..."
                className="w-full bg-card border border-border rounded-md pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted/50 text-muted-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <FilterDropdown
                label="Status"
                value={statusFilter}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                onChange={setStatusFilter}
              />
              <FilterDropdown
                label="Source Group"
                value={sourceFilter}
                options={SOURCE_GROUP_OPTIONS.map((s) => ({
                  value: s,
                  label: s,
                }))}
                onChange={setSourceFilter}
              />
              <FilterDropdown
                label="Interest"
                value={interestFilter}
                options={INTEREST_OPTIONS.map((i) => ({
                  value: i.field,
                  label: i.label,
                }))}
                onChange={setInterestFilter}
              />

              {/* Sort buttons */}
              <div className="ml-auto flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">
                  Sort:
                </span>
                {(
                  [
                    { field: "score" as SortField, label: "Score" },
                    { field: "lastActivity" as SortField, label: "Activity" },
                    { field: "created" as SortField, label: "Created" },
                  ] as const
                ).map(({ field, label }) => (
                  <button
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      sortField === field
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    {label}
                    {sortField === field && (
                      <CaretUpDown className="size-3 opacity-60" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Clear all filters
                </button>
              </motion.div>
            )}
          </motion.div>

          {/* ── View Tabs ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-6 overflow-x-auto scrollbar-hide -mx-2 px-2"
          >
            <div className="flex gap-1.5 min-w-max">
              {VIEW_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeView === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveView(tab.key)}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon
                      className="size-3.5"
                      weight={isActive ? "fill" : "regular"}
                    />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── Error ── */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-4">
                  <p className="text-destructive text-sm">{error}</p>
                  <button
                    onClick={() => fetchLeads()}
                    className="mt-1 text-sm text-destructive/80 hover:text-destructive underline"
                  >
                    Try again
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Lead Table ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[48px_1fr_auto_auto_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-2 bg-muted/30 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <span className="text-center">Score</span>
                <span>Name</span>
                <span className="hidden md:block min-w-[80px]">Status</span>
                <span className="hidden lg:block min-w-[140px]">
                  Event Interest
                </span>
                <span className="hidden xl:block min-w-[120px]">Interests</span>
                <span className="hidden lg:block min-w-[80px]">Source</span>
                <span className="hidden md:block min-w-[100px]">Phone</span>
                <span className="hidden md:block min-w-[60px] text-center">
                  Activity
                </span>
                <span className="min-w-[80px] text-right">Actions</span>
              </div>

              {/* Table body */}
              <div className="divide-y divide-border/20">
                {dataLoading ? (
                  // Skeleton loading
                  Array.from({ length: 12 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))
                ) : sortedLeads.length === 0 ? (
                  // Empty state
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="size-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                      <MagnifyingGlass className="size-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      No leads found
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {hasActiveFilters
                        ? "Try adjusting your filters or search query"
                        : "No leads available for this view"}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-3 text-xs text-primary hover:text-primary/80"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  // Lead rows
                  sortedLeads.map((lead, index) => {
                    const score = calculateLeadScore(lead);
                    const interests = getLeadInterests(lead);
                    const sourceGroup = getSourceGroup(lead.LeadSource);
                    const isUpdating = updatingLeadId === lead.Id;

                    return (
                      <motion.div
                        key={lead.Id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isUpdating ? 0.5 : 1 }}
                        transition={{ delay: index < 20 ? index * 0.02 : 0 }}
                        className="grid grid-cols-[48px_1fr_auto_auto_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-2 hover:bg-muted/10 transition-colors cursor-pointer group border-b border-border/50 last:border-0"
                        onClick={() => setSelectedLead(lead)}
                      >
                        {/* Score */}
                        <div className="flex justify-center">
                          <div
                            className={`flex items-center justify-center size-9 rounded-full text-xs font-bold ${getScoreBgColor(score)} ${getScoreColor(score)}`}
                          >
                            {score}
                          </div>
                        </div>

                        {/* Name + Company */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                              {lead.Name}
                            </p>
                            {lead.No_of_Guests__c != null &&
                              lead.No_of_Guests__c > 0 && (
                                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 shrink-0">
                                  <Users className="size-3" />
                                  {lead.No_of_Guests__c}
                                </span>
                              )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {lead.Company || "No company"}
                            {lead.Owner?.Name && (
                              <span className="text-muted-foreground/40">
                                {" "}
                                &middot; {lead.Owner.Name}
                              </span>
                            )}
                          </p>

                          {/* Inline note input */}
                          <AnimatePresence>
                            {noteInputLeadId === lead.Id && (
                              <InlineNoteInput
                                leadId={lead.Id}
                                currentNote={lead.Recent_Note__c}
                                onSave={saveNote}
                                onCancel={() => setNoteInputLeadId(null)}
                              />
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Status */}
                        <div
                          className="hidden md:block min-w-[80px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StatusDropdown
                            currentStatus={lead.Status}
                            onStatusChange={(s) => updateStatus(lead.Id, s)}
                            isOpen={openStatusDropdown === lead.Id}
                            onToggle={() =>
                              setOpenStatusDropdown(
                                openStatusDropdown === lead.Id
                                  ? null
                                  : lead.Id
                              )
                            }
                          />
                        </div>

                        {/* Event Interest */}
                        <div className="hidden lg:block min-w-[140px]">
                          {lead.Event_of_Interest__c ? (
                            <p className="text-xs text-foreground/80 truncate max-w-[140px]">
                              {lead.Event_of_Interest__c}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground/30">
                              --
                            </span>
                          )}
                        </div>

                        {/* Interests */}
                        <div className="hidden xl:flex gap-1 min-w-[120px] flex-wrap">
                          {interests.slice(0, 3).map((interest) => (
                            <span
                              key={interest.label}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                              style={{
                                backgroundColor: `${interest.color}20`,
                                color: interest.color,
                              }}
                            >
                              {interest.label}
                            </span>
                          ))}
                          {interests.length > 3 && (
                            <span className="text-[10px] text-muted-foreground/50">
                              +{interests.length - 3}
                            </span>
                          )}
                        </div>

                        {/* Source */}
                        <div className="hidden lg:block min-w-[80px]">
                          <span className="text-xs text-muted-foreground truncate">
                            {sourceGroup}
                          </span>
                        </div>

                        {/* Phone */}
                        <div className="hidden md:block min-w-[100px]">
                          {lead.Phone ? (
                            <a
                              href={`tel:${lead.Phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-primary transition-colors truncate block"
                            >
                              {lead.Phone}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/30">
                              --
                            </span>
                          )}
                        </div>

                        {/* Last Activity */}
                        <div className="hidden md:block min-w-[60px] text-center">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(lead.LastActivityDate)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="min-w-[80px] flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoteInputLeadId(
                                noteInputLeadId === lead.Id
                                  ? null
                                  : lead.Id
                              );
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors opacity-0 group-hover:opacity-100"
                            title="Add note"
                          >
                            <NotePencil className="size-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLead(lead);
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors opacity-0 group-hover:opacity-100"
                            title="View details"
                          >
                            <CaretRight className="size-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Footer count */}
            {!dataLoading && sortedLeads.length > 0 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <p className="text-xs text-muted-foreground/50">
                  Showing {sortedLeads.length} lead
                  {sortedLeads.length !== 1 ? "s" : ""}
                  {hasActiveFilters ? " (filtered)" : ""}
                </p>
                <p className="text-xs text-muted-foreground/30">
                  Sorted by {sortField === "lastActivity" ? "activity" : sortField}{" "}
                  {sortDirection === "desc" ? "descending" : "ascending"}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Lead Detail Panel ── */}
      <AnimatePresence>
        {selectedLead && (
          <LeadDetailPanel
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onStatusChange={updateStatus}
          />
        )}
      </AnimatePresence>
  );
}
