"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
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

// ── Client Card ──

function ClientCard({
  contact,
  isSelected,
  onClick,
}: {
  contact: SalesforceContact;
  isSelected: boolean;
  onClick: () => void;
}) {
  const spend = contact.Total_Spend_to_Date__c ?? 0;

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
          <p className="text-sm font-semibold tabular-nums text-emerald-500">
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
}: {
  detail: ClientDetailData | null;
  isLoading: boolean;
  onClose: () => void;
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
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {contact.Name}
            </h2>
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
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="rounded-lg bg-card border border-border p-4 shadow-sm text-center">
          <p className="text-2xl font-bold tabular-nums text-foreground">
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
      const res = await fetch(`/api/clients?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch clients");
      const json = await res.json();
      if (json.success) {
        // Sort by lifetime spend descending
        const sorted = (json.data as SalesforceContact[]).sort(
          (a, b) =>
            (b.Total_Spend_to_Date__c ?? 0) - (a.Total_Spend_to_Date__c ?? 0)
        );
        setContacts(sorted);
      } else {
        throw new Error(json.error || "Unknown error");
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients.");
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
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

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-6"
          >
            <div className="relative max-w-md">
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

          {/* Main Content: List + Detail */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex gap-6 min-h-[calc(100vh-240px)]"
          >
            {/* Client List */}
            <div
              className={`${
                selectedId ? "hidden lg:block lg:w-[380px]" : "w-full lg:w-[380px]"
              } shrink-0`}
            >
              <div className="overflow-y-auto max-h-[calc(100vh-240px)] pr-2 space-y-2 scrollbar-hide">
                {listLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-md bg-muted/30 border border-border animate-pulse flex flex-col"
                      >
                        <div className="flex justify-between">
                          <div>
                          <div className="h-4 w-32 bg-muted rounded mb-2" />
                          <div className="h-3 w-24 bg-muted rounded" />
                        </div>
                        <div className="h-4 w-16 bg-muted rounded" />
                      </div>
                      <div className="mt-3 pt-2 flex justify-between">
                        <div className="h-3 w-12 bg-muted rounded" />
                        <div className="h-3 w-20 bg-muted rounded" />
                      </div>
                    </div>
                    ))}
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground/50">
                    <User className="size-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">
                      {search
                        ? "No clients match your search"
                        : "No clients found"}
                    </p>
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <ClientCard
                      key={contact.Id}
                      contact={contact}
                      isSelected={selectedId === contact.Id}
                      onClick={() => handleSelectClient(contact.Id)}
                    />
                  ))
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
                />
              </div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
