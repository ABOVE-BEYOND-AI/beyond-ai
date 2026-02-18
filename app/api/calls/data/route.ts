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

    // Recent calls for feed (last 50, with contact info)
    const recentCalls: {
      id: number
      direction: string
      duration: number
      started_at: number
      status: string
      agent_name: string
      contact_name: string
      has_transcript: boolean
    }[] = calls.slice(0, 50).map((c: AircallCall) => ({
      id: c.id,
      direction: c.direction,
      duration: c.duration,
      started_at: c.started_at,
      status: c.status,
      agent_name: c.user?.name || 'Unknown',
      contact_name: c.contact
        ? [c.contact.first_name, c.contact.last_name].filter(Boolean).join(' ') || c.raw_digits
        : c.raw_digits || 'Unknown',
      has_transcript: c.duration >= 120,
    }))

    return NextResponse.json({
      success: true,
      data: {
        period,
        stats,
        repStats,
        recentCalls,
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
