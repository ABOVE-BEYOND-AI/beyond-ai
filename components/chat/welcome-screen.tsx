'use client'

import { motion } from 'framer-motion'
import {
  Sparkles,
  TrendingUp,
  BarChart3,
  Users,
  Calendar,
  Phone,
  Building2,
  FileText,
  Zap,
} from 'lucide-react'

const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, label: 'Daily briefing', prompt: 'Give me a daily briefing — deals closed today, new leads, and upcoming events this week.' },
  { icon: BarChart3, label: 'Sales this month', prompt: 'Show me the sales dashboard for this month with the leaderboard.' },
  { icon: Users, label: 'Hot leads', prompt: 'Show me all hot leads that need attention.' },
  { icon: Calendar, label: 'Upcoming events', prompt: 'What events are coming up in the next 30 days and how is ticket availability looking?' },
  { icon: Phone, label: 'Call activity', prompt: 'Show me call stats for this week — total calls, per rep breakdown.' },
  { icon: Building2, label: 'Top clients', prompt: 'Who are our top clients by total spend?' },
  { icon: FileText, label: 'Pipeline health', prompt: 'Show me the current open pipeline — total value and breakdown by stage.' },
  { icon: Zap, label: 'Channel performance', prompt: 'Which lead channels are driving the most revenue this year?' },
]

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void
}

export function WelcomeScreen({ onSelectPrompt }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-16">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
          <Sparkles className="size-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">AI Sales Assistant</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-3">
          How can I help you today?
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Ask about your pipeline, leads, events, clients, sales performance, or anything in Salesforce and Aircall.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl"
      >
        {SUGGESTED_PROMPTS.map((item, i) => (
          <button
            key={i}
            onClick={() => onSelectPrompt(item.prompt)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/50 text-left transition-all duration-200 group"
          >
            <item.icon className="size-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{item.prompt}</p>
            </div>
          </button>
        ))}
      </motion.div>
    </div>
  )
}
