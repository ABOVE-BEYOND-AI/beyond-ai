"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass,
  PaperPlaneTilt,
  Envelope,
  Lightning,
  ChartBar,
  Phone,
  Briefcase,
  FloppyDisk,
  CaretRight,
  Lock,
  Sparkle,
  Clock,
} from "@phosphor-icons/react";

// ── Sequence template data ──

interface SequenceTemplate {
  id: string;
  name: string;
  emailCount: number;
  duration: string;
  steps: { day: number; label: string; subject: string }[];
}

const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    id: "f1-cold",
    name: "F1 Cold Outreach",
    emailCount: 4,
    duration: "14 days",
    steps: [
      { day: 1, label: "Introduction", subject: "Experience F1 like never before" },
      { day: 3, label: "Follow-up", subject: "Quick follow-up - F1 hospitality" },
      { day: 7, label: "Value Add", subject: "What our F1 guests are saying" },
      { day: 14, label: "Break-up", subject: "Last chance - F1 packages filling fast" },
    ],
  },
  {
    id: "wimbledon",
    name: "Wimbledon Introduction",
    emailCount: 4,
    duration: "14 days",
    steps: [
      { day: 1, label: "Introduction", subject: "Wimbledon 2025 - Premium hospitality" },
      { day: 3, label: "Follow-up", subject: "Wimbledon availability update" },
      { day: 7, label: "Value Add", subject: "Centre Court experiences your clients will love" },
      { day: 14, label: "Break-up", subject: "Final call - Wimbledon packages" },
    ],
  },
  {
    id: "general",
    name: "General Hospitality",
    emailCount: 4,
    duration: "14 days",
    steps: [
      { day: 1, label: "Introduction", subject: "Unforgettable corporate hospitality experiences" },
      { day: 3, label: "Follow-up", subject: "Quick follow-up on hospitality options" },
      { day: 7, label: "Value Add", subject: "How top companies entertain their clients" },
      { day: 14, label: "Break-up", subject: "Shall we leave it here?" },
    ],
  },
  {
    id: "post-event",
    name: "Post-Event Follow-Up",
    emailCount: 3,
    duration: "10 days",
    steps: [
      { day: 1, label: "Thank You", subject: "Great to see you at [Event]" },
      { day: 5, label: "Feedback", subject: "How was your experience?" },
      { day: 10, label: "Next Event", subject: "Your next unforgettable experience awaits" },
    ],
  },
  {
    id: "re-engage",
    name: "Re-engagement",
    emailCount: 3,
    duration: "21 days",
    steps: [
      { day: 1, label: "Reconnect", subject: "We miss you - exciting new events" },
      { day: 7, label: "Value Add", subject: "What's new at Above & Beyond" },
      { day: 21, label: "Final Offer", subject: "Exclusive offer for returning clients" },
    ],
  },
];

// ── Stats Card ──

function StatCard({
  label,
  value,
  icon,
  delay,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-medium">
          {label}
        </span>
        {icon}
      </div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
    </motion.div>
  );
}

// ── Enrichment Result Row ──

function EnrichmentResultRow({
  label,
  icon,
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.04]">
      <div className="flex items-center justify-center size-8 rounded-lg bg-foreground/[0.04] text-muted-foreground/40">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground/40 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm text-muted-foreground/30 italic">{placeholder}</p>
      </div>
    </div>
  );
}

// ── Sequence Card ──

function SequenceCard({ template }: { template: SequenceTemplate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] overflow-hidden hover:border-foreground/[0.10] transition-all"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3"
      >
        <div className="flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary shrink-0">
          <Envelope className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{template.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-muted-foreground/50">
              {template.emailCount} emails
            </span>
            <span className="text-muted-foreground/20">|</span>
            <span className="text-[11px] text-muted-foreground/50">
              {template.duration}
            </span>
          </div>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-medium shrink-0">
          Template
        </span>
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground/40 shrink-0"
        >
          <CaretRight className="size-4" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-foreground/[0.04]">
              <div className="relative ml-4 mt-3">
                {/* Timeline line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-foreground/[0.08]" />
                <div className="space-y-4">
                  {template.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 relative">
                      <div className="flex items-center justify-center size-4 rounded-full bg-primary/20 border border-primary/30 shrink-0 mt-0.5 z-10">
                        <div className="size-1.5 rounded-full bg-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">
                            Day {step.day}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/[0.04] text-muted-foreground/60 font-medium">
                            {step.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground/70 mt-0.5 truncate">
                          {step.subject}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ──

export default function OutreachPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  const [enrichFirstName, setEnrichFirstName] = useState("");
  const [enrichLastName, setEnrichLastName] = useState("");
  const [enrichCompany, setEnrichCompany] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

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
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">Outreach</h1>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold uppercase tracking-wider">
                Beta
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Enrich contacts with Lusha and manage email sequences
            </p>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
            {/* ── Left Column: Lusha Enrichment ── */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-6"
            >
              {/* Enrichment Panel */}
              <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-foreground/[0.06]">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                    <MagnifyingGlass
                      className="size-4 text-blue-400"
                      weight="bold"
                    />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">
                      Lusha Enrichment
                    </h2>
                    <p className="text-[11px] text-muted-foreground/50">
                      Find direct contact details
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Input fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-1.5 block">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={enrichFirstName}
                        onChange={(e) => setEnrichFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full px-3 py-2.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-1.5 block">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={enrichLastName}
                        onChange={(e) => setEnrichLastName(e.target.value)}
                        placeholder="Smith"
                        className="w-full px-3 py-2.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-1.5 block">
                      Company
                    </label>
                    <input
                      type="text"
                      value={enrichCompany}
                      onChange={(e) => setEnrichCompany(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full px-3 py-2.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                    />
                  </div>

                  {/* Enrich Button */}
                  <div className="relative group">
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600/40 to-cyan-600/40 text-blue-300/60 font-medium text-sm cursor-not-allowed border border-blue-500/20"
                    >
                      <Lightning className="size-4" weight="fill" />
                      Enrich Contact
                      <Lock className="size-3.5 ml-1" />
                    </button>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg border border-zinc-700">
                      Coming Soon - Lusha API integration
                    </div>
                  </div>

                  {/* Results placeholder */}
                  <div className="pt-3 border-t border-foreground/[0.04] space-y-2.5">
                    <p className="text-[11px] text-muted-foreground/40 uppercase tracking-wider font-medium">
                      Enrichment Results
                    </p>
                    <EnrichmentResultRow
                      label="Direct Mobile"
                      icon={<Phone className="size-4" />}
                      placeholder="Not yet enriched"
                    />
                    <EnrichmentResultRow
                      label="Work Email"
                      icon={<Envelope className="size-4" />}
                      placeholder="Not yet enriched"
                    />
                    <EnrichmentResultRow
                      label="Personal Email"
                      icon={<Envelope className="size-4" />}
                      placeholder="Not yet enriched"
                    />
                    <EnrichmentResultRow
                      label="Job Title"
                      icon={<Briefcase className="size-4" />}
                      placeholder="Not yet enriched"
                    />
                  </div>

                  {/* Save to SF button */}
                  <div className="relative group">
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] text-muted-foreground/30 font-medium text-sm cursor-not-allowed"
                    >
                      <FloppyDisk className="size-4" />
                      Save to Salesforce
                      <Lock className="size-3.5 ml-1" />
                    </button>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg border border-zinc-700">
                      Requires enrichment data first
                    </div>
                  </div>
                </div>
              </div>

              {/* Outreach Dashboard Stats */}
              <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-foreground/[0.06]">
                  <ChartBar className="size-5 text-violet-400" weight="fill" />
                  <h2 className="text-base font-semibold tracking-tight">
                    Outreach Dashboard
                  </h2>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <StatCard
                      label="Sequences Active"
                      value="0"
                      icon={
                        <Lightning className="size-4 text-amber-400/40" />
                      }
                      delay={0.2}
                    />
                    <StatCard
                      label="Emails Sent"
                      value="0"
                      icon={
                        <PaperPlaneTilt className="size-4 text-blue-400/40" />
                      }
                      delay={0.25}
                    />
                    <StatCard
                      label="Open Rate"
                      value="0%"
                      icon={
                        <Envelope className="size-4 text-emerald-400/40" />
                      }
                      delay={0.3}
                    />
                    <StatCard
                      label="Reply Rate"
                      value="0%"
                      icon={
                        <ChartBar className="size-4 text-violet-400/40" />
                      }
                      delay={0.35}
                    />
                  </div>

                  {/* Empty state */}
                  <div className="rounded-xl bg-foreground/[0.02] border border-dashed border-foreground/[0.08] p-6 text-center">
                    <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 mx-auto mb-3">
                      <Sparkle className="size-6 text-primary/60" weight="fill" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground/60">
                      Connect Lusha and Gmail to start your outreach campaigns
                    </p>
                    <p className="text-xs text-muted-foreground/30 mt-1.5">
                      Automated sequences, enrichment, and tracking coming soon
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Right Column: Sequence Templates ── */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-foreground/[0.06]">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20">
                    <PaperPlaneTilt
                      className="size-4 text-violet-400"
                      weight="fill"
                    />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">
                      Email Sequence Templates
                    </h2>
                    <p className="text-[11px] text-muted-foreground/50">
                      {SEQUENCE_TEMPLATES.length} pre-built sequences ready to
                      customize
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {SEQUENCE_TEMPLATES.map((template, i) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                    >
                      <SequenceCard template={template} />
                    </motion.div>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="px-6 py-4 border-t border-foreground/[0.04] bg-foreground/[0.02]">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
                    <Clock className="size-3.5" />
                    <span>
                      Templates will be customizable once Gmail integration is
                      connected
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
