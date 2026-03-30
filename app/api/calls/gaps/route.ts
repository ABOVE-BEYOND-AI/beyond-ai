import { NextRequest, NextResponse } from 'next/server'
import { getGapsToday, computeTeamAvgGap, getLiveIdleData, computeGapsFromCalls } from '@/lib/call-gaps'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calls/gaps
 *
 * Returns today's gap data for all reps + team average.
 * Falls back to computing gaps from Aircall API data when Redis has no webhook data.
 * Query params:
 *   ?view=live — returns only live idle data (lightweight, for polling)
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view')

    if (view === 'live') {
      const liveData = await getLiveIdleData()
      return NextResponse.json({
        success: true,
        data: liveData,
      }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // Try Redis-based gap data first (from webhooks)
    let reps = await getGapsToday()

    // Fallback: compute gaps from Aircall API call data if no webhook data exists
    if (reps.length === 0) {
      try {
        const { getCachedCallsForPeriod } = await import('@/lib/aircall')
        const calls = await getCachedCallsForPeriod('today')
        if (calls.length > 0) {
          reps = computeGapsFromCalls(calls)
        }
      } catch (fallbackError) {
        console.warn('Gap fallback from API calls failed:', fallbackError)
      }
    }

    const teamAvg = computeTeamAvgGap(reps)

    return NextResponse.json({
      success: true,
      data: {
        reps,
        team_avg_gap_seconds: teamAvg.avg_gap_seconds,
        team_total_reps: teamAvg.total_reps,
        team_total_gaps: teamAvg.total_gaps,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching gap data:', error)
    return apiErrorResponse(error, 'Failed to fetch gap data')
  }
}
