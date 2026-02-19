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
  CurrencyGbp,
  CalendarBlank,
  User,
  Tag,
  Star,
  NotePencil,
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
        isSelected
          ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/5"
          : "bg-foreground/[0.03] border-foreground/[0.06] hover:bg-foreground/[0.06] hover:border-foreground/[0.10]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{contact.Name}</p>
          {contact.Account?.Name && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {contact.Account.Name}
            </p>
          )}
          {contact.Title && (
            <p className="text-xs text-muted-foreground/60 truncate">
              {contact.Title}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold tabular-nums text-emerald-400">
            {formatCurrency(spend)}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
            lifetime
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-foreground/[0.04]">
        <span className="text-[11px] text-muted-foreground/50">
          {contact.LastActivityDate
            ? formatRelativeTime(contact.LastActivityDate)
            : "No activity"}
        </span>
        <span className="text-[11px] text-muted-foreground/40">
          {contact.Owner?.Name || "Unassigned"}
        </span>
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
      <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {contact.Name}
            </h2>
            {contact.Account?.Name && (
              <div className="flex items-center gap-2 mt-1 text-muted-foreground">
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
            className="hidden lg:flex p-2 rounded-lg hover:bg-foreground/10 transition-colors text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Contact info row */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {contact.Phone && (
            <a
              href={`tel:${contact.Phone}`}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="size-4" />
              {contact.Phone}
            </a>
          )}
          {contact.Email && (
            <a
              href={`mailto:${contact.Email}`}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <EnvelopeSimple className="size-4" />
              {contact.Email}
            </a>
          )}
          {contact.LinkedIn__c && (
            <a
              href={contact.LinkedIn__c}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <LinkedinLogo className="size-4" weight="fill" />
              LinkedIn
            </a>
          )}
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-4 text-center">
          <CurrencyGbp className="size-5 mx-auto mb-2 text-emerald-400" weight="bold" />
          <p className="text-xl font-bold tabular-nums text-emerald-400">
            {formatCurrency(lifetimeValue)}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Total Spend
          </p>
        </div>
        <div className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-4 text-center">
          <CalendarBlank className="size-5 mx-auto mb-2 text-blue-400" />
          <p className="text-xl font-bold tabular-nums">{totalBookings}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Total Bookings
          </p>
        </div>
        <div className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-4 text-center">
          <Star className="size-5 mx-auto mb-2 text-amber-400" />
          <p className="text-xl font-bold tabular-nums">{memberSince}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
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
      <div className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <CalendarBlank className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Event History</h3>
        </div>
        {sortedYears.length === 0 ? (
          <p className="text-sm text-muted-foreground/50 text-center py-4">
            No opportunities found
          </p>
        ) : (
          <div className="space-y-4">
            {sortedYears.map((year) => (
              <div key={year}>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
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
                        className="flex items-center gap-3 p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.04]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {eventName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stageBadge(
                                opp.StageName
                              )}`}
                            >
                              {opp.StageName}
                            </span>
                            {opp.Event__r?.Category__c && (
                              <span className="text-[10px] text-muted-foreground/50">
                                {opp.Event__r.Category__c}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-bold tabular-nums shrink-0">
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
        <div className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-4">
          <div className="flex items-center gap-2 mb-4">
            <NotePencil className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Notes ({notes.length})
            </h3>
          </div>
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.Id}
                className="p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.04]"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {note.Name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                    <span>{note.Owner?.Alias || "Unknown"}</span>
                    <span>{formatRelativeTime(note.CreatedDate)}</span>
                  </div>
                </div>
                {note.Body__c && (
                  <p className="text-sm text-muted-foreground/80 whitespace-pre-wrap leading-relaxed">
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
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 lg:p-8 pl-24">
        <div className="max-w-7xl mx-auto">
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
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
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
                        className="p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] animate-pulse"
                      >
                        <div className="flex justify-between">
                          <div>
                            <div className="h-4 w-32 bg-muted rounded mb-2" />
                            <div className="h-3 w-24 bg-muted/60 rounded" />
                          </div>
                          <div className="h-4 w-16 bg-muted rounded" />
                        </div>
                        <div className="mt-3 pt-2 border-t border-foreground/[0.04] flex justify-between">
                          <div className="h-3 w-12 bg-muted/40 rounded" />
                          <div className="h-3 w-20 bg-muted/40 rounded" />
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
