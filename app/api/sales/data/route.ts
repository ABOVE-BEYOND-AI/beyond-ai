import { NextRequest, NextResponse } from 'next/server'
import { getDashboardData, type SalesPeriod } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'month') as SalesPeriod

    if (!['today', 'week', 'month', 'year'].includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
    }

    const data = await getDashboardData(period)

    return NextResponse.json({
      success: true,
      data,
    }, {
      headers: {
        // Short cache — stale-while-revalidate lets the UI feel instant
        // while background refresh gets fresh data
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    console.error('Sales Data API error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch sales data',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 },
    )
  }
}
