"use client";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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
  Play,
  Pause,
  Stop,
  X,
  User,
  CheckCircle,
  CircleNotch,
  Warning,
} from "@phosphor-icons/react";

// ── Types for active sequences (mirrors server types) ──

interface ActiveSequenceStep {
  day: number;
  subject: string;
  body: string;
  scheduledAt: string | null;
  sentAt: string | null;
}

interface ActiveSequence {
  id: string;
  templateId: string;
  contactId: string;
  contactEmail: string;
  contactName: string;
  repEmail: string;
  repName: string;
  status: "active" | "paused" | "completed" | "cancelled";
  currentStep: number;
  steps: ActiveSequenceStep[];
  startedAt: string;
  updatedAt: string;
}

interface SequenceStats {
  activeCount: number;
  pausedCount: number;
  emailsSent: number;
}

// ── Sequence template data ──

interface SequenceTemplate {
  id: string;
  name: string;
  emailCount: number;
  duration: string;
  steps: { day: number; label: string; subject: string; body: string }[];
}

const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    id: "f1-cold",
    name: "F1 Cold Outreach",
    emailCount: 4,
    duration: "14 days",
    steps: [
      {
        day: 1,
        label: "Introduction",
        subject: "Experience F1 like never before",
        body: `<p>Hi {{firstName}},</p><p>I'm {{repName}} from Above &amp; Beyond. We specialise in premium F1 hospitality experiences that your clients and team will never forget.</p><p>Would you be open to a quick chat about what we can offer for the upcoming season?</p><p>Best regards,<br/>{{repName}}</p>`,
      },
      {
        day: 3,
        label: "Follow-up",
        subject: "Quick follow-up - F1 hospitality",
        body: `<p>Hi {{firstName}},</p><p>Just following up on my last note. I know how busy things get, so I'll keep this brief.</p><p>Our F1 paddock and hospitality packages are filling up fast this year. Happy to send over a quick overview if helpful.</p><p>Cheers,<br/>{{repName}}</p>`,
      },
      {
        day: 7,
        label: "Value Add",
        subject: "What our F1 guests are saying",
        body: `<p>Hi {{firstName}},</p><p>Thought I'd share some quick feedback from recent guests. Our F1 experiences consistently score 9.5+ for client entertainment.</p><p>I'd love to walk you through what a typical race weekend looks like with us. Just 10 minutes — happy to work around your schedule.</p><p>Best,<br/>{{repName}}</p>`,
      },
      {
        day: 14,
        label: "Break-up",
        subject: "Last chance - F1 packages filling fast",
        body: `<p>Hi {{firstName}},</p><p>This will be my last note — I don't want to crowd your inbox. If F1 hospitality for {{company}} isn't a priority right now, no worries at all.</p><p>If things change, I'm always here. Wishing you a great week ahead.</p><p>All the best,<br/>{{repName}}</p>`,
      },
    ],
  },
  {
    id: "wimbledon",
    name: "Wimbledon Introduction",
    emailCount: 4,
    duration: "14 days",
    steps: [
      {
        day: 1,
        label: "Introduction",
        subject: "Wimbledon 2025 - Premium hospitality",
        body: `<p>Hi {{firstName}},</p><p>I'm reaching out from Above &amp; Beyond about our Wimbledon 2025 hospitality packages. We offer everything from Centre Court debenture seats to private suites.</p><p>Would it make sense to have a quick conversation about hospitality options for {{company}}?</p><p>Best regards,<br/>{{repName}}</p>`,
      },
      {
        day: 3,
        label: "Follow-up",
        subject: "Wimbledon availability update",
        body: `<p>Hi {{firstName}},</p><p>Quick update — availability for our premium Wimbledon packages is tightening. Centre Court dates during the second week are particularly popular.</p><p>Happy to hold some options if you'd like to explore this further.</p><p>Cheers,<br/>{{repName}}</p>`,
      },
      {
        day: 7,
        label: "Value Add",
        subject:
          "Centre Court experiences your clients will love",
        body: `<p>Hi {{firstName}},</p><p>Our Wimbledon hospitality has been a huge hit with corporate clients looking to entertain at the highest level. Think: Champagne reception, gourmet dining, and the best seats in the house.</p><p>I'd love to send you a tailored proposal for {{company}}. Shall I put something together?</p><p>Best,<br/>{{repName}}</p>`,
      },
      {
        day: 14,
        label: "Break-up",
        subject: "Final call - Wimbledon packages",
        body: `<p>Hi {{firstName}},</p><p>I'll leave you in peace after this one! If Wimbledon hospitality isn't on the radar for {{company}} right now, totally understand.</p><p>My door is always open if you'd like to chat in the future. Have a great week.</p><p>Warm regards,<br/>{{repName}}</p>`,
      },
    ],
  },
  {
    id: "general",
    name: "General Hospitality",
    emailCount: 4,
    duration: "14 days",
    steps: [
      {
        day: 1,
        label: "Introduction",
        subject: "Unforgettable corporate hospitality experiences",
        body: `<p>Hi {{firstName}},</p><p>I'm {{repName}} from Above &amp; Beyond. We create bespoke corporate hospitality experiences across the world's biggest sporting events — F1, Wimbledon, Six Nations, and more.</p><p>Would you be interested in learning how we can help {{company}} entertain clients in style?</p><p>Best regards,<br/>{{repName}}</p>`,
      },
      {
        day: 3,
        label: "Follow-up",
        subject: "Quick follow-up on hospitality options",
        body: `<p>Hi {{firstName}},</p><p>Just circling back on my earlier message. I appreciate you're busy — here's a one-liner summary: we help companies like {{company}} create unforgettable client entertainment moments at premium events.</p><p>Worth a quick chat?</p><p>Cheers,<br/>{{repName}}</p>`,
      },
      {
        day: 7,
        label: "Value Add",
        subject: "How top companies entertain their clients",
        body: `<p>Hi {{firstName}},</p><p>I wanted to share how some of the UK's leading companies are using experiential hospitality to strengthen client relationships. It's become one of the most effective ways to stand out.</p><p>I'd love to show you what a tailored programme looks like for {{company}}. Just 15 minutes — happy to work around you.</p><p>Best,<br/>{{repName}}</p>`,
      },
      {
        day: 14,
        label: "Break-up",
        subject: "Shall we leave it here?",
        body: `<p>Hi {{firstName}},</p><p>I don't want to be a nuisance, so this will be my last message. If corporate hospitality for {{company}} isn't a priority right now, I completely understand.</p><p>If anything changes, you know where to find me. Wishing you all the best.</p><p>Kind regards,<br/>{{repName}}</p>`,
      },
    ],
  },
  {
    id: "post-event",
    name: "Post-Event Follow-Up",
    emailCount: 3,
    duration: "10 days",
    steps: [
      {
        day: 1,
        label: "Thank You",
        subject: "Great to see you at {{eventName}}",
        body: `<p>Hi {{firstName}},</p><p>It was wonderful having you at {{eventName}}! I hope you and the team had an amazing time.</p><p>I'd love to hear your thoughts on the experience — always looking to make things even better.</p><p>Best regards,<br/>{{repName}}</p>`,
      },
      {
        day: 5,
        label: "Feedback",
        subject: "How was your experience?",
        body: `<p>Hi {{firstName}},</p><p>Just checking in to see how you found {{eventName}}. We value your feedback and it helps us shape future experiences for {{company}}.</p><p>Any highlights or areas we could improve?</p><p>Cheers,<br/>{{repName}}</p>`,
      },
      {
        day: 10,
        label: "Next Event",
        subject: "Your next unforgettable experience awaits",
        body: `<p>Hi {{firstName}},</p><p>We've got some exciting events coming up that I think {{company}} would love. Shall I send over some options?</p><p>Would be great to work with you again.</p><p>Best,<br/>{{repName}}</p>`,
      },
    ],
  },
  {
    id: "re-engage",
    name: "Re-engagement",
    emailCount: 3,
    duration: "21 days",
    steps: [
      {
        day: 1,
        label: "Reconnect",
        subject: "We miss you - exciting new events",
        body: `<p>Hi {{firstName}},</p><p>It's been a while since we last connected, and I wanted to reach out with some exciting updates from Above &amp; Beyond.</p><p>We've got some incredible new events on the calendar that I think {{company}} would love. Fancy a catch-up?</p><p>Best regards,<br/>{{repName}}</p>`,
      },
      {
        day: 7,
        label: "Value Add",
        subject: "What's new at Above & Beyond",
        body: `<p>Hi {{firstName}},</p><p>Since we last spoke, we've expanded our offering significantly — new venues, new events, and even more exclusive experiences.</p><p>I'd love to give you a quick update over a call. Just 10 minutes.</p><p>Cheers,<br/>{{repName}}</p>`,
      },
      {
        day: 21,
        label: "Final Offer",
        subject: "Exclusive offer for returning clients",
        body: `<p>Hi {{firstName}},</p><p>As a valued past client, I'd like to offer {{company}} an exclusive preview of our upcoming events with priority booking.</p><p>No pressure at all — just wanted you to know the door is open. Let me know if you'd like details.</p><p>Warm regards,<br/>{{repName}}</p>`,
      },
    ],
  },
];

// ── Template variable replacement ──

function replaceTemplateVars(
  text: string,
  vars: {
    firstName?: string;
    company?: string;
    eventName?: string;
    repName?: string;
  }
): string {
  let result = text;
  if (vars.firstName) result = result.replace(/\{\{firstName\}\}/g, vars.firstName);
  if (vars.company) result = result.replace(/\{\{company\}\}/g, vars.company);
  if (vars.eventName) result = result.replace(/\{\{eventName\}\}/g, vars.eventName);
  if (vars.repName) result = result.replace(/\{\{repName\}\}/g, vars.repName);
  return result;
}

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

// ── Active Sequence Row ──

function ActiveSequenceRow({
  sequence,
  onAction,
  actionLoading,
}: {
  sequence: ActiveSequence;
  onAction: (id: string, action: "pause" | "resume" | "cancel") => void;
  actionLoading: string | null;
}) {
  const sentCount = sequence.steps.filter((s) => s.sentAt).length;
  const totalSteps = sequence.steps.length;
  const progress = totalSteps > 0 ? (sentCount / totalSteps) * 100 : 0;
  const isLoading = actionLoading === sequence.id;

  return (
    <div className="rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] p-4 hover:border-foreground/[0.10] transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold truncate">
              {sequence.contactName}
            </p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                sequence.status === "active"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : sequence.status === "paused"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : sequence.status === "completed"
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                  : "bg-red-500/15 text-red-400 border border-red-500/20"
              }`}
            >
              {sequence.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground/50 truncate">
            {sequence.contactEmail}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {sequence.status === "active" && (
            <button
              onClick={() => onAction(sequence.id, "pause")}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all disabled:opacity-50"
              title="Pause sequence"
            >
              {isLoading ? (
                <CircleNotch className="size-3.5 animate-spin" />
              ) : (
                <Pause className="size-3.5" weight="fill" />
              )}
            </button>
          )}
          {sequence.status === "paused" && (
            <button
              onClick={() => onAction(sequence.id, "resume")}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all disabled:opacity-50"
              title="Resume sequence"
            >
              {isLoading ? (
                <CircleNotch className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" weight="fill" />
              )}
            </button>
          )}
          {(sequence.status === "active" || sequence.status === "paused") && (
            <button
              onClick={() => onAction(sequence.id, "cancel")}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all disabled:opacity-50"
              title="Cancel sequence"
            >
              <Stop className="size-3.5" weight="fill" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className={`h-full rounded-full ${
              sequence.status === "completed"
                ? "bg-blue-500"
                : sequence.status === "paused"
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
          />
        </div>
        <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
          {sentCount}/{totalSteps} sent
        </span>
      </div>
    </div>
  );
}

// ── Sequence Card (with Start Sequence button) ──

function SequenceCard({
  template,
  onStartSequence,
}: {
  template: SequenceTemplate;
  onStartSequence: (template: SequenceTemplate) => void;
}) {
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartSequence(template);
          }}
          className="text-[10px] px-3 py-1.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-medium shrink-0 hover:bg-primary/25 hover:border-primary/40 transition-all"
        >
          Start Sequence
        </button>
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

// ── Start Sequence Modal ──

function StartSequenceModal({
  template,
  repName,
  onClose,
  onStart,
  starting,
}: {
  template: SequenceTemplate;
  repName: string;
  onClose: () => void;
  onStart: (data: {
    contactEmail: string;
    contactName: string;
    company: string;
    eventName: string;
  }) => void;
  starting: boolean;
}) {
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [eventName, setEventName] = useState("");
  const [previewStep, setPreviewStep] = useState(0);

  const firstName = contactName.split(" ")[0] || "{{firstName}}";

  const previewVars = {
    firstName: firstName || undefined,
    company: company || undefined,
    eventName: eventName || undefined,
    repName,
  };

  const currentStep = template.steps[previewStep];
  const previewSubject = currentStep
    ? replaceTemplateVars(currentStep.subject, previewVars)
    : "";
  const previewBody = currentStep
    ? replaceTemplateVars(currentStep.body, previewVars)
    : "";

  const canSubmit = contactEmail.trim() && contactName.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-background border border-foreground/[0.08] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/[0.06]">
          <div>
            <h3 className="text-lg font-semibold">Start Sequence</h3>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              {template.name} — {template.emailCount} emails over{" "}
              {template.duration}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-foreground/[0.06] transition-colors text-muted-foreground/50"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact details */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User className="size-4 text-primary" />
              Contact Details
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-1.5 block">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-1.5 block">
                  Email *
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-1.5 block">
                  Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-1.5 block">
                  Event Name
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Monaco Grand Prix"
                  className="w-full px-3 py-2.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.08] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Merge field legend */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground/40 uppercase tracking-wider font-medium">
              Merge fields:
            </span>
            {["{{firstName}}", "{{company}}", "{{eventName}}", "{{repName}}"].map(
              (tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded bg-foreground/[0.06] text-muted-foreground/60 font-mono"
                >
                  {tag}
                </span>
              )
            )}
          </div>

          {/* Email preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Envelope className="size-4 text-primary" />
                Email Preview
              </h4>
              <div className="flex items-center gap-1">
                {template.steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewStep(i)}
                    className={`text-[10px] px-2 py-1 rounded-md font-medium transition-all ${
                      previewStep === i
                        ? "bg-primary/15 text-primary border border-primary/25"
                        : "bg-foreground/[0.04] text-muted-foreground/50 border border-transparent hover:border-foreground/[0.08]"
                    }`}
                  >
                    Day {template.steps[i].day}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] overflow-hidden">
              <div className="px-4 py-3 border-b border-foreground/[0.04]">
                <p className="text-xs text-muted-foreground/40 mb-1">
                  Subject:
                </p>
                <p className="text-sm font-medium">{previewSubject}</p>
              </div>
              <div
                className="px-4 py-4 text-sm text-muted-foreground/70 leading-relaxed [&_p]:mb-3 last:[&_p]:mb-0"
                dangerouslySetInnerHTML={{ __html: previewBody }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-foreground/[0.06] bg-foreground/[0.02]">
          <p className="text-xs text-muted-foreground/40">
            First email sends within minutes of starting
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.04] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onStart({ contactEmail, contactName, company, eventName })
              }
              disabled={!canSubmit || starting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <PaperPlaneTilt className="size-4" weight="fill" />
                  Start Sequence
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ──

export default function OutreachPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  // Existing enrichment state
  const [enrichFirstName, setEnrichFirstName] = useState("");
  const [enrichLastName, setEnrichLastName] = useState("");
  const [enrichCompany, setEnrichCompany] = useState("");

  // Sequence state
  const [sequences, setSequences] = useState<ActiveSequence[]>([]);
  const [stats, setStats] = useState<SequenceStats>({
    activeCount: 0,
    pausedCount: 0,
    emailsSent: 0,
  });
  const [sequencesLoading, setSequencesLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal state
  const [selectedTemplate, setSelectedTemplate] =
    useState<SequenceTemplate | null>(null);
  const [startingSequence, setStartingSequence] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // ── Fetch sequences ──
  const fetchSequences = useCallback(async () => {
    try {
      const res = await fetch("/api/email/sequences");
      const data = await res.json();
      if (data.success) {
        setSequences(data.data.sequences || []);
        setStats(
          data.data.stats || { activeCount: 0, pausedCount: 0, emailsSent: 0 }
        );
      }
    } catch (error) {
      console.error("Failed to fetch sequences:", error);
    } finally {
      setSequencesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchSequences();
    }
  }, [user, fetchSequences]);

  // ── Sequence actions ──
  const handleSequenceAction = async (
    id: string,
    action: "pause" | "resume" | "cancel"
  ) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/email/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchSequences();
        showToast(
          `Sequence ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "cancelled"}`,
          "success"
        );
      } else {
        showToast(data.error || "Action failed", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Start sequence ──
  const handleStartSequence = async (data: {
    contactEmail: string;
    contactName: string;
    company: string;
    eventName: string;
  }) => {
    if (!selectedTemplate || !user) return;
    setStartingSequence(true);

    const firstName = data.contactName.split(" ")[0];
    const vars = {
      firstName,
      company: data.company,
      eventName: data.eventName,
      repName: user.name,
    };

    try {
      const res = await fetch("/api/email/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          contactId: "",
          contactEmail: data.contactEmail,
          contactName: data.contactName,
          steps: selectedTemplate.steps.map((s) => ({
            day: s.day,
            subject: replaceTemplateVars(s.subject, vars),
            body: replaceTemplateVars(s.body, vars),
          })),
        }),
      });
      const result = await res.json();
      if (result.success) {
        showToast(
          `Sequence started for ${data.contactName}`,
          "success"
        );
        setSelectedTemplate(null);
        await fetchSequences();
      } else {
        showToast(result.error || "Failed to start sequence", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setStartingSequence(false);
    }
  };

  // ── Toast ──
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 pl-24 lg:p-8 lg:pl-24">
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
          {/* ── Left Column: Lusha Enrichment + Stats ── */}
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
                    value={String(stats.activeCount)}
                    icon={
                      <Lightning className="size-4 text-amber-400/40" />
                    }
                    delay={0.2}
                  />
                  <StatCard
                    label="Emails Sent"
                    value={String(stats.emailsSent)}
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

                {/* Empty state or sequence list hint */}
                {stats.activeCount === 0 && stats.emailsSent === 0 ? (
                  <div className="rounded-xl bg-foreground/[0.02] border border-dashed border-foreground/[0.08] p-6 text-center">
                    <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 mx-auto mb-3">
                      <Sparkle
                        className="size-6 text-primary/60"
                        weight="fill"
                      />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground/60">
                      Start a sequence from a template to begin your outreach
                    </p>
                    <p className="text-xs text-muted-foreground/30 mt-1.5">
                      Select a template on the right and click &quot;Start
                      Sequence&quot;
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-foreground/[0.02] border border-foreground/[0.06] p-4 text-center">
                    <p className="text-xs text-muted-foreground/50">
                      {stats.pausedCount > 0
                        ? `${stats.pausedCount} sequence${stats.pausedCount > 1 ? "s" : ""} paused`
                        : "All sequences running"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Right Column: Active Sequences + Templates ── */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="space-y-6"
          >
            {/* Active Sequences Section */}
            <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-foreground/[0.06]">
                <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <Lightning
                    className="size-4 text-emerald-400"
                    weight="fill"
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold tracking-tight">
                    Active Sequences
                  </h2>
                  <p className="text-[11px] text-muted-foreground/50">
                    {sequences.length} sequence{sequences.length !== 1 ? "s" : ""}{" "}
                    running
                  </p>
                </div>
              </div>

              <div className="p-5">
                {sequencesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <CircleNotch className="size-6 text-muted-foreground/30 animate-spin" />
                  </div>
                ) : sequences.length === 0 ? (
                  <div className="rounded-xl bg-foreground/[0.02] border border-dashed border-foreground/[0.08] p-6 text-center">
                    <div className="flex items-center justify-center size-10 rounded-full bg-foreground/[0.04] mx-auto mb-3">
                      <PaperPlaneTilt className="size-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground/50">
                      No active sequences
                    </p>
                    <p className="text-xs text-muted-foreground/30 mt-1">
                      Start one from the templates below
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sequences.map((seq) => (
                      <motion.div
                        key={seq.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <ActiveSequenceRow
                          sequence={seq}
                          onAction={handleSequenceAction}
                          actionLoading={actionLoading}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sequence Templates */}
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
                    <SequenceCard
                      template={template}
                      onStartSequence={setSelectedTemplate}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-6 py-4 border-t border-foreground/[0.04] bg-foreground/[0.02]">
                <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
                  <Clock className="size-3.5" />
                  <span>
                    Click &quot;Start Sequence&quot; to customise merge fields and
                    begin sending
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Start Sequence Modal */}
      <AnimatePresence>
        {selectedTemplate && (
          <StartSequenceModal
            template={selectedTemplate}
            repName={user.name}
            onClose={() => setSelectedTemplate(null)}
            onStart={handleStartSequence}
            starting={startingSequence}
          />
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${
              toast.type === "success"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                : "bg-red-500/15 text-red-400 border-red-500/25"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="size-4" weight="fill" />
            ) : (
              <Warning className="size-4" weight="fill" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
