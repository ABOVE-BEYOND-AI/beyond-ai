import { NextRequest, NextResponse } from 'next/server'
import { getCallDashboardData, type CallPeriod } from '@/lib/call-dashboard'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'today') as CallPeriod
    const { data, cached, stale } = await getCallDashboardData(period)

    return NextResponse.json({
      success: true,
      data,
      cached,
      stale,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Error fetching call data:', error)
    return apiErrorResponse(error, 'Failed to fetch call data')
  }
}
