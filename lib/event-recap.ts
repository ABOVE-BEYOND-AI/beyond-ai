// Daily event recap data aggregator
// Aggregates deals, calls, leads, and upcoming events for end-of-day summary

import { getDealsClosedToday, getLeadsCreatedToday, getUpcomingEvents } from './salesforce'
import { getTodayCalls, computeCallStats } from './aircall'
import { Redis } from '@upstash/redis'
import type { SalesforceOpportunityFull } from './salesforce-types'
import type { SalesforceEvent as SalesforceEventRecord } from './salesforce-types'

// ── Types ──

export interface EventRecapDeal {
  name: string
  amount: number
  owner: string
  event: string
  accountName: string | null
  guests: number | null
}

export interface EventRecapEvent {
  name: string
  startDate: string | null
  category: string | null
  revenueTarget: number | null
  closedWonGross: number | null
  percentageToTarget: number | null
}

export interface EventRecapCallStats {
  total: number
  inbound: number
  outbound: number
  answered: number
  missed: number
  totalDuration: number // seconds
  avgDuration: number   // seconds
}

export interface EventRecapData {
  date: string // ISO date YYYY-MM-DD
  dealsClosedToday: EventRecapDeal[]
  totalDealValue: number
  dealCount: number
  leadsCreatedToday: number
  upcomingEvents: EventRecapEvent[]
  callStats: EventRecapCallStats | null
  generatedAt: string // ISO datetime
}

// ── Redis cache helper ──

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const RECAP_CACHE_KEY = (date: string) => `event_recap:${date}`
const RECAP_CACHE_TTL = 300 // 5 minutes

// ── Mapping helpers ──

function mapDeal(d: SalesforceOpportunityFull): EventRecapDeal {
  return {
    name: d.Name || 'Unknown',
    amount: d.Gross_Amount__c ?? d.Amount ?? 0,
    owner: d.Owner?.Name || 'Unknown',
    event: d.Event__r?.Name || 'N/A',
    accountName: d.Account?.Name || null,
    guests: d.Total_Number_of_Guests__c ?? null,
  }
}

function mapEvent(e: SalesforceEventRecord): EventRecapEvent {
  return {
    name: e.Name || 'Unknown',
    startDate: e.Start_Date__c || null,
    category: e.Category__c || null,
    revenueTarget: e.Revenue_Target__c ?? null,
    closedWonGross: e.Sum_of_Closed_Won_Gross__c ?? null,
    percentageToTarget: e.Percentage_to_Target__c ?? null,
  }
}

// ── Main aggregator ──

export async function generateEventRecap(forceRefresh = false): Promise<EventRecapData> {
  const today = new Date().toISOString().split('T')[0]
  const redis = getRedis()

  // Check cache first (unless force refresh)
  if (!forceRefresh && redis) {
    try {
      const cached = await redis.get<EventRecapData>(RECAP_CACHE_KEY(today))
      if (cached) return cached
    } catch (err) {
      console.warn('Redis recap cache read failed:', err)
    }
  }

  // Fetch all data sources in parallel
  // Using Promise.allSettled so a single failure doesn't break the whole recap
  const [dealsResult, leadsResult, eventsResult, callsResult] = await Promise.allSettled([
    getDealsClosedToday(),
    getLeadsCreatedToday(),
    getUpcomingEvents(7),
    getTodayCalls(),
  ])

  // Extract settled values with safe fallbacks
  const deals: SalesforceOpportunityFull[] =
    dealsResult.status === 'fulfilled' ? dealsResult.value : []
  const leadCount: number =
    leadsResult.status === 'fulfilled' ? leadsResult.value : 0
  const events: SalesforceEventRecord[] =
    eventsResult.status === 'fulfilled' ? eventsResult.value : []

  // Build call stats (optional — Aircall may be unavailable)
  let callStats: EventRecapCallStats | null = null
  if (callsResult.status === 'fulfilled') {
    const stats = computeCallStats(callsResult.value)
    callStats = {
      total: stats.total_calls,
      inbound: stats.inbound_calls,
      outbound: stats.outbound_calls,
      answered: stats.answered_calls,
      missed: stats.missed_calls,
      totalDuration: stats.total_duration,
      avgDuration: stats.avg_duration,
    }
  }

  // Log any data source failures for observability
  if (dealsResult.status === 'rejected') {
    console.error('Event recap: failed to fetch deals:', dealsResult.reason)
  }
  if (leadsResult.status === 'rejected') {
    console.error('Event recap: failed to fetch leads:', leadsResult.reason)
  }
  if (eventsResult.status === 'rejected') {
    console.error('Event recap: failed to fetch events:', eventsResult.reason)
  }
  if (callsResult.status === 'rejected') {
    console.warn('Event recap: failed to fetch calls (optional):', callsResult.reason)
  }

  const mappedDeals = deals.map(mapDeal)
  const totalDealValue = mappedDeals.reduce((sum, d) => sum + d.amount, 0)

  const recap: EventRecapData = {
    date: today,
    dealsClosedToday: mappedDeals,
    totalDealValue,
    dealCount: mappedDeals.length,
    leadsCreatedToday: leadCount,
    upcomingEvents: events.map(mapEvent),
    callStats,
    generatedAt: new Date().toISOString(),
  }

  // Write to cache (non-blocking)
  if (redis) {
    redis
      .set(RECAP_CACHE_KEY(today), recap, { ex: RECAP_CACHE_TTL })
      .catch(err => console.warn('Redis recap cache write failed:', err))
  }

  return recap
}
