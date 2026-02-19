import { NextResponse } from 'next/server'
import { getChannelAttribution, getRepPerformance, getEventPerformance } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
