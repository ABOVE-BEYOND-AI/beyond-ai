import { NextRequest, NextResponse } from 'next/server'
import { getGapsToday, getTeamAvgGap, getLiveIdleData } from '@/lib/call-gaps'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calls/gaps
 *
 * Returns today's gap data for all reps + team average.
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

    const [reps, teamAvg] = await Promise.all([
      getGapsToday(),
      getTeamAvgGap(),
    ])

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
