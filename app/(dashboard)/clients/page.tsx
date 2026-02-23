"use client";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass,
  X,
  Phone,
  EnvelopeSimple,
  LinkedinLogo,
  Buildings,
  User,
  Tag,
  ArrowLeft,
  Rows,
  SquaresFour,
  Funnel,
  SortAscending,
  CurrencyGbp,
  NotePencil,
  ArrowSquareOut,
  PhoneCall,
  CalendarCheck,
  CaretRight,
  Star,
} from "@phosphor-icons/react";
import type {
  SalesforceContact,
  SalesforceOpportunityFull,
  ABNote,
} from "@/lib/salesforce-types";
import {
  formatCurrency,
  formatRelativeTime,
  OPPORTUNITY_STAGES,
} from "@/lib/constants";

// ── Types ──

type ViewMode = "cards" | "list";
type AccountView = "all" | "personal" | "business";
type SortBy = "activity" | "spend" | "name" | "created";

interface ClientDetailData {
  contact: SalesforceContact;
  opportunities: SalesforceOpportunityFull[];
  notes: ABNote[];
  lifetimeValue: number;
  totalBookings: number;
  oppsByYear: Record<string, SalesforceOpportunityFull[]>;
}

// ── Stage badge helper ──

function stageBadge(stage: string) {
  const config = OPPORTUNITY_STAGES[stage];
  if (!config) return "bg-zinc-500/15 text-zinc-400";
  return config.bgColor;
}

// ── Spend color helper ──

function spendTier(amount: number): { color: string; bg: string; border: string; label: string } {
  if (amount >= 50000) return { color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/25", label: "VIP" };
  if (amount >= 10000) return { color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/25", label: "Premium" };
  if (amount >= 1000) return { color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/25", label: "Active" };
  return { color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", label: "" };
}

// ── Client Card (Grid View) ──

function ClientGridCard({
  contact,
  isSelected,
  onClick,
  delay = 0,
}: {
  contact: SalesforceContact;
  isSelected: boolean;
  onClick: () => void;
  delay?: number;
}) {
  const spend = contact.Total_Spend_to_Date__c ?? 0;
  const tier = spendTier(spend);
  const bookings = contact.Total_Won_Opportunities__c ?? 0;
  const tags = contact.Tags__c ? contact.Tags__c.split(";").map(t => t.trim()).filter(Boolean) : [];
  const interests = contact.Interests__c ? contact.Interests__c.split(";").map(t => t.trim()).filter(Boolean) : [];
  const lastActivity = contact.LastActivityDate ? formatRelativeTime(contact.LastActivityDate) : "No activity";

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`w-full text-left rounded-2xl border transition-all duration-200 group overflow-hidden relative ${
        isSelected
          ? "bg-primary/5 border-primary/30 shadow-lg shadow-primary/5"
          : "bg-card border-border/50 hover:border-foreground/15 hover:shadow-md"
      }`}
    >
      {/* Spend tier accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${tier.bg}`} />

      <div className="p-4 pl-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate text-foreground">{contact.Name}</p>
            {contact.Account?.Name && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                <Buildings className="size-3 shrink-0" />
                {contact.Account.Name}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold tabular-nums ${tier.color}`}>
              {formatCurrency(spend)}
            </p>
            {tier.label && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold ${tier.bg} ${tier.color} ${tier.border} border`}>
                {tier.label}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3">
          {bookings > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
              <CalendarCheck className="size-3" />
              {bookings} booking{bookings !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-muted-foreground/60">{lastActivity}</span>
        </div>

        {/* Tags + Interests chips */}
        {(tags.length > 0 || interests.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15 truncate max-w-[120px]">
                {tag}
              </span>
            ))}
            {interests.slice(0, 2).map(interest => (
              <span key={interest} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/15 truncate max-w-[120px]">
                {interest}
              </span>
            ))}
            {tags.length + interests.length > 5 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                +{tags.length + interests.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ── Client List Row ──

function ClientListRow({
  contact,
  isSelected,
  onClick,
}: {
  contact: SalesforceContact;
  isSelected: boolean;
  onClick: () => void;
}) {
  const spend = contact.Total_Spend_to_Date__c ?? 0;
  const tier = spendTier(spend);

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full text-left p-3 rounded-md transition-all duration-150 group flex flex-col ${
        isSelected
          ? "bg-primary/5 shadow-sm"
          : "hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate text-foreground">{contact.Name}</p>
          {contact.Account?.Name && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {contact.Account.Name}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold tabular-nums ${tier.color}`}>
            {formatCurrency(spend)}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

// ── Detail Panel ──

function ClientDetail({
  detail,
  isLoading,
  onClose,
  onAnalyseCall,
}: {
  detail: ClientDetailData | null;
  isLoading: boolean;
  onClose: () => void;
  onAnalyseCall?: (contactName: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/40">
        <div className="text-center">
          <User className="size-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Select a client</p>
          <p className="text-sm mt-1">
            Choose a client from the list to view their 360 profile
          </p>
        </div>
      </div>
    );
  }

  const { contact, notes, lifetimeValue, totalBookings, oppsByYear } = detail;
  const memberSince = contact.CreatedDate
    ? new Date(contact.CreatedDate).getFullYear()
    : "N/A";
  const sortedYears = Object.keys(oppsByYear).sort((a, b) => b.localeCompare(a));
  const tags = contact.Tags__c
    ? contact.Tags__c.split(";").map((t) => t.trim()).filter(Boolean)
    : [];
  const interests = contact.Interests__c
    ? contact.Interests__c.split(";").map((t) => t.trim()).filter(Boolean)
    : [];
  const score = contact.Score__c;
  const tier = spendTier(lifetimeValue);

  return (
    <motion.div
      key={contact.Id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 overflow-y-auto"
    >
      {/* Back button (mobile) */}
      <button
        onClick={onClose}
        className="lg:hidden flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to list
      </button>

      {/* Header Card */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                {contact.Name}
              </h2>
              {score !== null && score > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                  <Star className="size-3" weight="fill" />
                  {score}
                </span>
              )}
            </div>
            {contact.Account?.Name && (
              <div className="flex items-center gap-2 mt-1.5 text-muted-foreground font-medium">
                <Buildings className="size-4" />
                <span className="text-sm">{contact.Account.Name}</span>
                {contact.Title && (
                  <>
                    <span className="text-muted-foreground/30">-</span>
                    <span className="text-sm">{contact.Title}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="hidden lg:flex p-2 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Contact info row */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {contact.Phone && (
            <a
              href={`tel:${contact.Phone}`}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="size-4" weight="fill" />
              {contact.Phone}
            </a>
          )}
          {contact.Email && (
            <a
              href={`mailto:${contact.Email}`}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <EnvelopeSimple className="size-4" weight="fill" />
              {contact.Email}
            </a>
          )}
          {contact.LinkedIn__c && (
            <a
              href={contact.LinkedIn__c}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors"
            >
              <LinkedinLogo className="size-4" weight="fill" />
              LinkedIn
            </a>
          )}
        </div>

        {/* Quick action links */}
        <div className="flex flex-wrap gap-2 mt-4">
          {contact.Phone && (
            <button
              onClick={() => onAnalyseCall?.(contact.Name)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] hover:bg-foreground/[0.08] transition-colors text-muted-foreground"
            >
              <PhoneCall className="size-3.5" />
              Call History
            </button>
          )}
          <a
            href={`https://login.salesforce.com/${contact.Id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] hover:bg-foreground/[0.08] transition-colors text-muted-foreground"
          >
            <ArrowSquareOut className="size-3.5" />
            Open in Salesforce
          </a>
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg bg-card border border-border p-4 shadow-sm text-center">
          <p className={`text-2xl font-bold tabular-nums ${tier.color}`}>
            {formatCurrency(lifetimeValue)}
          </p>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            Total Spend
          </p>
        </div>
        <div className="rounded-lg bg-card border border-border p-4 shadow-sm text-center">
          <p className="text-2xl font-bold tabular-nums text-foreground">{totalBookings}</p>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            Bookings
          </p>
        </div>
        <div className="rounded-lg bg-card border border-border p-4 shadow-sm text-center">
          <p className="text-2xl font-bold tabular-nums text-foreground">{memberSince}</p>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            Member Since
          </p>
        </div>
      </div>

      {/* Tags + Interests */}
      {(tags.length > 0 || interests.length > 0) && (
        <div className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Tags & Interests</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs rounded-full bg-primary/15 text-primary border border-primary/20"
              >
                {tag}
              </span>
            ))}
            {interests.map((interest) => (
              <span
                key={interest}
                className="px-2.5 py-1 text-xs rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Note */}
      {contact.Recent_Note__c && (
        <div className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <NotePencil className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Latest Note</h3>
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-4">
            {contact.Recent_Note__c}
          </p>
        </div>
      )}

      {/* Event History */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Event History</h3>
        </div>
        {sortedYears.length === 0 ? (
          <p className="text-sm text-muted-foreground/50 text-center py-4">
            No opportunities found
          </p>
        ) : (
          <div className="space-y-6">
            {sortedYears.map((year) => (
              <div key={year}>
                <p className="text-xs font-bold text-muted-foreground mb-3">
                  {year}
                </p>
                <div className="space-y-2">
                  {oppsByYear[year].map((opp) => {
                    const amount =
                      opp.Gross_Amount__c ?? opp.Amount ?? 0;
                    const eventName =
                      opp.Event__r?.Name || opp.Name;
                    return (
                      <div
                        key={opp.Id}
                        className="flex items-center gap-3 p-3 rounded-md bg-card border border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">
                            {eventName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider ${stageBadge(
                                opp.StageName
                              )}`}
                            >
                              {opp.StageName}
                            </span>
                            {opp.Event__r?.Category__c && (
                              <span className="text-[10px] font-medium text-muted-foreground/70">
                                {opp.Event__r.Category__c}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-bold tabular-nums shrink-0 text-foreground">
                          {formatCurrency(amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Notes ({notes.length})
            </h3>
          </div>
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.Id}
                className="p-4 rounded-md bg-muted/30 border border-border/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {note.Name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/60">
                    <span>{note.Owner?.Alias || "Unknown"}</span>
                    <span>&middot;</span>
                    <span>{formatRelativeTime(note.CreatedDate)}</span>
                  </div>
                </div>
                {note.Body__c && (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-medium">
                    {note.Body__c}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ──

export default function ClientsPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [contacts, setContacts] = useState<SalesforceContact[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Enhanced filters
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [accountView, setAccountView] = useState<AccountView>("all");
  const [sortBy, setSortBy] = useState<SortBy>("spend");
  const [spendFilter, setSpendFilter] = useState<string>("");
  const [noteKeyword, setNoteKeyword] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Fetch contact list
  const fetchContacts = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (sortBy) params.set("sortBy", sortBy);
      if (accountView !== "all") params.set("view", accountView);
      if (noteKeyword.trim()) params.set("noteKeyword", noteKeyword.trim());

      // Spend filter presets
      if (spendFilter === "50k+") params.set("minSpend", "50000");
      else if (spendFilter === "10k-50k") {
        params.set("minSpend", "10000");
        params.set("maxSpend", "50000");
      } else if (spendFilter === "1k-10k") {
        params.set("minSpend", "1000");
        params.set("maxSpend", "10000");
      } else if (spendFilter === "<1k") params.set("maxSpend", "1000");

      const res = await fetch(`/api/clients?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch clients");
      const json = await res.json();
      if (json.success) {
        setContacts(json.data as SalesforceContact[]);
      } else {
        throw new Error(json.error || "Unknown error");
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients.");
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, sortBy, accountView, spendFilter, noteKeyword]);

  useEffect(() => {
    if (user) fetchContacts();
  }, [user, fetchContacts]);

  // Fetch client detail
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error("Failed to fetch client detail");
      const json = await res.json();
      if (json.success) {
        setDetail(json.data as ClientDetailData);
      }
    } catch (err) {
      console.error("Error fetching client detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelectClient = useCallback(
    (id: string) => {
      setSelectedId(id);
      fetchDetail(id);
    },
    [fetchDetail]
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  const activeFilterCount = [
    accountView !== "all",
    spendFilter !== "",
    noteKeyword.trim() !== "",
  ].filter(Boolean).length;

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
          <h1 className="text-3xl font-bold tracking-tight">Client 360</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contacts.length > 0
              ? `${contacts.length} client${contacts.length !== 1 ? "s" : ""}`
              : "Search and manage your client relationships"}
          </p>
        </motion.div>

        {/* Search + Controls Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-5 space-y-3"
        >
          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, company, or email..."
                className="w-full pl-9 pr-9 py-2 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex bg-muted/60 rounded-lg p-0.5 border border-border/40">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2 rounded-md transition-all ${
                  viewMode === "cards"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Card view"
              >
                <SquaresFour className="size-4" weight={viewMode === "cards" ? "fill" : "regular"} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="List view"
              >
                <Rows className="size-4" weight={viewMode === "list" ? "fill" : "regular"} />
              </button>
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-1.5">
              <SortAscending className="size-4 text-muted-foreground/50" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="text-xs bg-card border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer pr-7"
              >
                <option value="spend">Top Spenders</option>
                <option value="activity">Most Active</option>
                <option value="name">Name A–Z</option>
                <option value="created">Newest First</option>
              </select>
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                showFilters || activeFilterCount > 0
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Funnel className="size-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Expanded filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                  {/* Account type segmented control */}
                  <div className="flex bg-muted/60 rounded-lg p-0.5 border border-border/40">
                    {(["all", "personal", "business"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setAccountView(v)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          accountView === v
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v === "all" ? "All" : v === "personal" ? "Personal" : "Business"}
                      </button>
                    ))}
                  </div>

                  {/* Spend filter */}
                  <div className="flex items-center gap-1.5">
                    <CurrencyGbp className="size-3.5 text-muted-foreground/50" />
                    <select
                      value={spendFilter}
                      onChange={(e) => setSpendFilter(e.target.value)}
                      className="text-xs bg-muted/50 border border-border/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                    >
                      <option value="">Any spend</option>
                      <option value="50k+">£50k+ (VIP)</option>
                      <option value="10k-50k">£10k – £50k</option>
                      <option value="1k-10k">£1k – £10k</option>
                      <option value="<1k">Under £1k</option>
                    </select>
                  </div>

                  {/* Notes keyword search */}
                  <div className="flex items-center gap-1.5">
                    <NotePencil className="size-3.5 text-muted-foreground/50" />
                    <input
                      type="text"
                      value={noteKeyword}
                      onChange={(e) => setNoteKeyword(e.target.value)}
                      placeholder="Search in notes..."
                      className="text-xs bg-muted/50 border border-border/40 rounded-lg px-2.5 py-1.5 w-40 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                    />
                  </div>

                  {/* Clear all filters */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setAccountView("all");
                        setSpendFilter("");
                        setNoteKeyword("");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline ml-auto"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Main Content: Grid/List + Detail */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex gap-6 min-h-[calc(100vh-280px)]"
        >
          {/* Client List / Grid */}
          <div
            className={`${
              selectedId ? "hidden lg:block lg:w-[420px]" : "w-full"
            } shrink-0`}
          >
            <div className="overflow-y-auto max-h-[calc(100vh-280px)] pr-2 scrollbar-hide">
              {listLoading ? (
                viewMode === "cards" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-2xl bg-card border border-border/50 animate-pulse"
                      >
                        <div className="flex justify-between mb-3">
                          <div>
                            <div className="h-4 w-28 bg-muted rounded mb-2" />
                            <div className="h-3 w-20 bg-muted/60 rounded" />
                          </div>
                          <div className="h-5 w-14 bg-muted rounded" />
                        </div>
                        <div className="h-3 w-24 bg-muted/40 rounded mb-3" />
                        <div className="flex gap-2">
                          <div className="h-5 w-16 bg-muted/30 rounded-full" />
                          <div className="h-5 w-14 bg-muted/30 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-md bg-muted/30 border border-border animate-pulse flex justify-between"
                      >
                        <div>
                          <div className="h-4 w-32 bg-muted rounded mb-2" />
                          <div className="h-3 w-24 bg-muted/60 rounded" />
                        </div>
                        <div className="h-4 w-16 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                )
              ) : contacts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground/50">
                  <User className="size-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {search || activeFilterCount > 0
                      ? "No clients match your filters"
                      : "No clients found"}
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setAccountView("all");
                        setSpendFilter("");
                        setNoteKeyword("");
                      }}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : viewMode === "cards" ? (
                <div className={`grid gap-3 ${
                  selectedId
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                }`}>
                  {contacts.map((contact, i) => (
                    <ClientGridCard
                      key={contact.Id}
                      contact={contact}
                      isSelected={selectedId === contact.Id}
                      onClick={() => handleSelectClient(contact.Id)}
                      delay={Math.min(i * 0.02, 0.3)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {contacts.map((contact) => (
                    <ClientListRow
                      key={contact.Id}
                      contact={contact}
                      isSelected={selectedId === contact.Id}
                      onClick={() => handleSelectClient(contact.Id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence mode="wait">
            <div
              className={`${
                selectedId ? "flex flex-col flex-1 min-w-0" : "hidden lg:flex flex-col flex-1 min-w-0"
              }`}
            >
              <ClientDetail
                detail={detail}
                isLoading={detailLoading}
                onClose={handleCloseDetail}
                onAnalyseCall={(name) => router.push(`/calls?search=${encodeURIComponent(name)}`)}
              />
            </div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
