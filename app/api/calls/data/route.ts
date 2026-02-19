import { NextRequest, NextResponse } from 'next/server'
import {
  getCallsForPeriod,
  computeCallStats,
  computeRepStats,
  type AircallCall,
} from '@/lib/aircall'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

// ── Redis cache ──

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// Much longer TTLs — Aircall only allows 60 req/min, so aggressive caching is essential.
// Today still refreshes frequently since it's the most viewed period.
const CACHE_TTL: Record<string, number> = {
  today: 180,    // 3 minutes
  week: 600,     // 10 minutes
  month: 1800,   // 30 minutes
}

// Stale data TTL — serve stale data while refreshing in background.
// This is how long we keep stale data available as a fallback.
const STALE_TTL: Record<string, number> = {
  today: 600,    // 10 minutes
  week: 3600,    // 1 hour
  month: 7200,   // 2 hours
}

function cacheKey(period: string): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return `calls_data:${period}:${date}`
}

function lockKey(period: string): string {
  return `calls_data_lock:${period}`
}

function staleKey(period: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `calls_data_stale:${period}:${date}`
}

// ── Build response data from raw calls ──

function buildResponseData(period: string, calls: AircallCall[]) {
  const stats = computeCallStats(calls)
  const repStats = computeRepStats(calls)

  // Meaningful calls: 3+ min, answered
  const meaningfulCalls = calls.filter(
    c => c.duration >= 180 && (c.status === 'answered' || c.answered_at)
  )

  // Hourly distribution
  const hourlyDistribution: Record<number, { inbound: number; outbound: number }> = {}
  for (let h = 8; h <= 18; h++) {
    hourlyDistribution[h] = { inbound: 0, outbound: 0 }
  }
  for (const call of calls) {
    const hour = new Date(call.started_at * 1000).getHours()
    if (hour >= 8 && hour <= 18) {
      if (call.direction === 'inbound') {
        hourlyDistribution[hour].inbound++
      } else {
        hourlyDistribution[hour].outbound++
      }
    }
  }

  const mapCall = (c: AircallCall) => ({
    id: c.id,
    direction: c.direction,
    duration: c.duration,
    started_at: c.started_at,
    status: c.status,
    agent_name: c.user?.name || 'Unknown',
    contact_name: c.contact
      ? [c.contact.first_name, c.contact.last_name].filter(Boolean).join(' ') || c.raw_digits
      : c.raw_digits || 'Unknown',
    has_recording: !!(c.recording || c.asset),
  })

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'today') as 'today' | 'week' | 'month'

    const redis = getRedis()

    // ── Step 1: Try fresh cache ──
    if (redis) {
      try {
        const cached = await redis.get(cacheKey(period))
        if (cached) {
          return NextResponse.json(
            { success: true, data: cached, cached: true },
            { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
          )
        }
      } catch (cacheErr) {
        console.warn('Redis cache read failed:', cacheErr)
      }
    }

    // ── Step 2: Acquire lock to prevent stampede ──
    // If another request is already fetching, serve stale data instead of queuing another Aircall fetch
    if (redis) {
      try {
        const lockAcquired = await redis.set(lockKey(period), '1', { nx: true, ex: 120 })

        if (!lockAcquired) {
          // Another request is already fetching — serve stale data if available
          const stale = await redis.get(staleKey(period))
          if (stale) {
            console.log(`🔄 Serving stale data for ${period} (refresh in progress)`)
            return NextResponse.json(
              { success: true, data: stale, cached: true, stale: true },
              { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } }
            )
          }
          // No stale data — wait a bit and try cache again
          await new Promise(resolve => setTimeout(resolve, 3000))
          const retryCache = await redis.get(cacheKey(period))
          if (retryCache) {
            return NextResponse.json(
              { success: true, data: retryCache, cached: true },
              { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
            )
          }
          // Fall through to fetch anyway
        }
      } catch (lockErr) {
        console.warn('Lock acquire failed, proceeding:', lockErr)
      }
    }

    // ── Step 3: Fetch from Aircall API ──
    console.log(`📞 Fetching ${period} call data from Aircall API...`)
    const calls = await getCallsForPeriod(period)
    const responseData = buildResponseData(period, calls)

    // ── Step 4: Update caches ──
    if (redis) {
      const pipeline = redis.pipeline()
      // Fresh cache with normal TTL
      pipeline.set(cacheKey(period), responseData, { ex: CACHE_TTL[period] || 180 })
      // Stale cache with longer TTL (fallback for future requests during refresh)
      pipeline.set(staleKey(period), responseData, { ex: STALE_TTL[period] || 600 })
      // Release lock
      pipeline.del(lockKey(period))
      pipeline.exec().catch(err => console.warn('Redis pipeline failed:', err))
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Error fetching call data:', error)

    // ── Fallback: try serving stale data on error ──
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const redis = getRedis()
    if (redis) {
      try {
        // Release lock on error so next request can retry
        await redis.del(lockKey(period))
        const stale = await redis.get(staleKey(period))
        if (stale) {
          console.log(`⚠️ Serving stale data for ${period} after API error`)
          return NextResponse.json(
            { success: true, data: stale, cached: true, stale: true },
            { headers: { 'Cache-Control': 'no-cache' } }
          )
        }
      } catch (staleErr) {
        console.warn('Failed to read stale data:', staleErr)
      }
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch call data' },
      { status: 500 }
    )
  }
}
