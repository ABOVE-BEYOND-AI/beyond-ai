import { NextRequest, NextResponse } from 'next/server'
import { getChannelAttribution, getRepPerformance, getEventPerformance } from '@/lib/salesforce'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const [channelAttribution, repPerformance, eventPerformance] = await Promise.all([
      getChannelAttribution(),
      getRepPerformance(),
      getEventPerformance(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        channelAttribution,
        repPerformance,
        eventPerformance,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return apiErrorResponse(error, 'Failed to fetch analytics')
  }
}
