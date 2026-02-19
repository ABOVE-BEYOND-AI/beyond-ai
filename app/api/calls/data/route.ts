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

const CACHE_TTL: Record<string, number> = {
  today: 60,    // 1 minute
  week: 120,    // 2 minutes
  month: 300,   // 5 minutes
}

function cacheKey(period: string): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return `calls_data:${period}:${date}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'today') as 'today' | 'week' | 'month'

    // Check Redis cache first
    const redis = getRedis()
    if (redis) {
      try {
        const cached = await redis.get(cacheKey(period))
        if (cached) {
          return NextResponse.json(
            { success: true, data: cached, cached: true },
            { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
          )
        }
      } catch (cacheErr) {
        console.warn('Redis cache read failed, proceeding without cache:', cacheErr)
      }
    }

    const calls = await getCallsForPeriod(period)

    // Compute stats
    const stats = computeCallStats(calls)
    const repStats = computeRepStats(calls)

    // Get calls worth analysing (3+ minutes, answered — shorter calls are usually
    // voicemail, gatekeeper, or hold music and produce poor transcripts)
    const meaningfulCalls = calls.filter(
      c => c.duration >= 180 && (c.status === 'answered' || c.answered_at)
    )

    // Build hourly distribution for chart data
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

    // Map a call to a slim response object
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

    // Recent calls for the feed (last 50)
    const recentCalls = calls.slice(0, 50).map(mapCall)

    // ALL meaningful calls (3+ mins) — separate list for Intelligence tab
    const analysableCalls = meaningfulCalls.slice(0, 100).map(mapCall)

    const responseData = {
      period,
      stats,
      repStats,
      recentCalls,
      analysableCalls,
      meaningfulCallCount: meaningfulCalls.length,
      hourlyDistribution,
    }

    // Cache in Redis (non-blocking)
    if (redis) {
      redis.set(cacheKey(period), responseData, { ex: CACHE_TTL[period] || 60 }).catch(err =>
        console.warn('Redis cache write failed:', err)
      )
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('Error fetching call data:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch call data' },
      { status: 500 }
    )
  }
}
