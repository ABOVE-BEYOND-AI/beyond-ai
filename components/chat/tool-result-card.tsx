/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { DashboardCard } from './cards/dashboard-card'
import { LeadsCard } from './cards/leads-card'
import { PipelineCard } from './cards/pipeline-card'
import { EventsCard } from './cards/events-card'
import { ClientsCard } from './cards/clients-card'
import { ClientDetailCard } from './cards/client-detail-card'
import { FinanceCard } from './cards/finance-card'
import { CallsCard } from './cards/calls-card'
import { AnalyticsCard } from './cards/analytics-card'
import { TargetsCard } from './cards/targets-card'
import { DailyRecapCard } from './cards/daily-recap-card'
import { EventDealsCard } from './cards/event-deals-card'
import { WriteResultCard } from './cards/write-result-card'
import { RepsCard } from './cards/reps-card'

const CARD_MAP: Record<string, React.ComponentType<{ data: any }>> = {
  searchLeads: LeadsCard,
  getPipeline: PipelineCard,
  getSalesDashboard: DashboardCard,
  getEvents: EventsCard,
  getEventDeals: EventDealsCard,
  searchClients: ClientsCard,
  getClientDetail: ClientDetailCard,
  getFinanceData: FinanceCard,
  getCallActivity: CallsCard,
  getAnalytics: AnalyticsCard,
  getTargetsAndCommission: TargetsCard,
  getDailyRecap: DailyRecapCard,
  updateLeadStatus: WriteResultCard,
  updateDealStage: WriteResultCard,
  addNote: WriteResultCard,
  getSalesReps: RepsCard,
}

const LOADING_LABELS: Record<string, string> = {
  searchLeads: 'Searching leads',
  getPipeline: 'Loading pipeline',
  getSalesDashboard: 'Fetching sales data',
  getEvents: 'Loading events',
  getEventDeals: 'Loading event deals',
  searchClients: 'Searching clients',
  getClientDetail: 'Loading client details',
  getFinanceData: 'Loading finance data',
  getCallActivity: 'Loading call stats',
  getAnalytics: 'Running analytics',
  getTargetsAndCommission: 'Loading targets',
  getDailyRecap: 'Building daily recap',
  updateLeadStatus: 'Updating lead',
  updateDealStage: 'Updating deal',
  addNote: 'Creating note',
  getSalesReps: 'Loading sales reps',
}

interface ToolResultCardProps {
  toolName: string
  state: string
  result?: any
}

export function ToolResultCard({ toolName, state, result }: ToolResultCardProps) {
  if (state !== 'result') {
    return (
      <div className="my-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>{LOADING_LABELS[toolName] || 'Loading'}...</span>
      </div>
    )
  }

  const CardComponent = CARD_MAP[toolName]
  if (!CardComponent) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="my-3"
    >
      <CardComponent data={result} />
    </motion.div>
  )
}
