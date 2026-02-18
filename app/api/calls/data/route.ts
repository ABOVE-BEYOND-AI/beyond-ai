import { NextRequest, NextResponse } from 'next/server'
import {
  getCallsForPeriod,
  computeCallStats,
  computeRepStats,
  type AircallCall,
} from '@/lib/aircall'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'today') as 'today' | 'week' | 'month'

    const calls = await getCallsForPeriod(period)

    // Compute stats
    const stats = computeCallStats(calls)
    const repStats = computeRepStats(calls)

    // Get calls worth analysing (2+ minutes, answered)
    const meaningfulCalls = calls.filter(
      c => c.duration >= 120 && (c.status === 'answered' || c.answered_at)
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

    // ALL meaningful calls (2+ mins) — separate list for Intelligence tab
    const analysableCalls = meaningfulCalls.slice(0, 100).map(mapCall)

    return NextResponse.json({
      success: true,
      data: {
        period,
        stats,
        repStats,
        recentCalls,
        analysableCalls,
        meaningfulCallCount: meaningfulCalls.length,
        hourlyDistribution,
      },
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
