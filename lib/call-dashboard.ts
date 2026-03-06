import { Redis } from '@upstash/redis'
import {
  computeCallStats,
  computeRepStats,
  getCallsForPeriod,
  type AircallCall,
  type CallStats,
  type RepCallStats,
} from './aircall'

export type CallPeriod = 'today' | 'week' | 'month'

export interface CallListItem {
  id: number
  direction: string
  duration: number
  started_at: number
  status: string
  agent_name: string
  contact_name: string
  has_recording: boolean
}

export interface CallDashboardData {
  period: CallPeriod
  stats: CallStats
  repStats: RepCallStats[]
  recentCalls: CallListItem[]
  analysableCalls: CallListItem[]
  meaningfulCallCount: number
  hourlyDistribution: Record<number, { inbound: number; outbound: number }>
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const CACHE_TTL: Record<CallPeriod, number> = {
  today: 180,
  week: 600,
  month: 1800,
}

const STALE_TTL: Record<CallPeriod, number> = {
  today: 600,
  week: 3600,
  month: 7200,
}

function cacheKey(period: CallPeriod): string {
  const date = new Date().toISOString().slice(0, 10)
  return `calls_data:${period}:${date}`
}

function staleKey(period: CallPeriod): string {
  const date = new Date().toISOString().slice(0, 10)
  return `calls_data_stale:${period}:${date}`
}

function lockKey(period: CallPeriod): string {
  return `calls_data_lock:${period}`
}

function mapCall(call: AircallCall): CallListItem {
  return {
    id: call.id,
    direction: call.direction,
    duration: call.duration,
    started_at: call.started_at,
    status: call.status,
    agent_name: call.user?.name || 'Unknown',
    contact_name: call.contact
      ? [call.contact.first_name, call.contact.last_name].filter(Boolean).join(' ') || call.raw_digits
      : call.raw_digits || 'Unknown',
    has_recording: !!(call.recording || call.asset),
  }
}

function buildCallDashboardData(period: CallPeriod, calls: AircallCall[]): CallDashboardData {
  const stats = computeCallStats(calls)
  const repStats = computeRepStats(calls)
  const meaningfulCalls = calls.filter(
    (call) => call.duration >= 180 && (call.status === 'answered' || call.answered_at)
  )

  const hourlyDistribution: Record<number, { inbound: number; outbound: number }> = {}
  for (let hour = 8; hour <= 18; hour++) {
    hourlyDistribution[hour] = { inbound: 0, outbound: 0 }
  }

  for (const call of calls) {
    const hour = new Date(call.started_at * 1000).getHours()
    if (hour >= 8 && hour <= 18) {
      if (call.direction === 'inbound') {
        hourlyDistribution[hour].inbound += 1
      } else {
        hourlyDistribution[hour].outbound += 1
      }
    }
  }

  return {
    period,
    stats,
    repStats,
    recentCalls: calls.slice(0, 50).map(mapCall),
    analysableCalls: meaningfulCalls.slice(0, 100).map(mapCall),
    meaningfulCallCount: meaningfulCalls.length,
    hourlyDistribution,
  }
}

export async function getCallDashboardData(period: CallPeriod): Promise<{
  data: CallDashboardData
  cached: boolean
  stale: boolean
}> {
  const redis = getRedis()

  if (redis) {
    try {
      const cached = await redis.get<CallDashboardData>(cacheKey(period))
      if (cached) {
        return { data: cached, cached: true, stale: false }
      }
    } catch (error) {
      console.warn('Redis call cache read failed:', error)
    }
  }

  if (redis) {
    try {
      const lockAcquired = await redis.set(lockKey(period), '1', { nx: true, ex: 120 })

      if (!lockAcquired) {
        const stale = await redis.get<CallDashboardData>(staleKey(period))
        if (stale) {
          return { data: stale, cached: true, stale: true }
        }

        await new Promise((resolve) => setTimeout(resolve, 3000))
        const retryCache = await redis.get<CallDashboardData>(cacheKey(period))
        if (retryCache) {
          return { data: retryCache, cached: true, stale: false }
        }
      }
    } catch (error) {
      console.warn('Redis call lock acquire failed:', error)
    }
  }

  try {
    const calls = await getCallsForPeriod(period)
    const data = buildCallDashboardData(period, calls)

    if (redis) {
      const pipeline = redis.pipeline()
      pipeline.set(cacheKey(period), data, { ex: CACHE_TTL[period] })
      pipeline.set(staleKey(period), data, { ex: STALE_TTL[period] })
      pipeline.del(lockKey(period))
      pipeline.exec().catch((error) => console.warn('Redis call cache write failed:', error))
    }

    return { data, cached: false, stale: false }
  } catch (error) {
    if (redis) {
      try {
        await redis.del(lockKey(period))
        const stale = await redis.get<CallDashboardData>(staleKey(period))
        if (stale) {
          return { data: stale, cached: true, stale: true }
        }
      } catch (staleError) {
        console.warn('Redis stale call cache read failed:', staleError)
      }
    }

    throw error
  }
}
