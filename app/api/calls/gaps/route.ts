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

    // Fetch yesterday's data for comparison (non-blocking — don't fail if unavailable)
    let yesterday: { team_avg_gap_seconds: number; reps: Record<string, number> } | null = null
    try {
      const { getCachedCallsForDate } = await import('@/lib/aircall')
      const yd = new Date()
      yd.setDate(yd.getDate() - 1)
      // Skip weekends — if yesterday is Sunday go to Friday, Saturday go to Thursday
      const day = yd.getDay()
      if (day === 0) yd.setDate(yd.getDate() - 2) // Sunday → Friday
      else if (day === 6) yd.setDate(yd.getDate() - 1) // Saturday → Friday

      const ydCalls = await getCachedCallsForDate(yd)
      if (ydCalls.length > 0) {
        const ydReps = computeGapsFromCalls(ydCalls)
        const ydTeam = computeTeamAvgGap(ydReps)
        const repMap: Record<string, number> = {}
        for (const r of ydReps) {
          if (r.gap_count > 0) repMap[r.aircall_user_id.toString()] = r.avg_gap_seconds
        }
        yesterday = { team_avg_gap_seconds: ydTeam.avg_gap_seconds, reps: repMap }
      }
    } catch {
      // Yesterday comparison is optional — don't fail the response
    }

    return NextResponse.json({
      success: true,
      data: {
        reps,
        team_avg_gap_seconds: teamAvg.avg_gap_seconds,
        team_total_reps: teamAvg.total_reps,
        team_total_gaps: teamAvg.total_gaps,
        yesterday,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching gap data:', error)
    return apiErrorResponse(error, 'Failed to fetch gap data')
  }
}
