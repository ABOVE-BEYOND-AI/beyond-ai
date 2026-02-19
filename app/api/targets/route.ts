import { NextRequest, NextResponse } from 'next/server'
import { getMonthlyTargets, getCommissionData } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const year = searchParams.get('year') || String(now.getFullYear())
    const month = searchParams.get('month') || now.toLocaleString('en-GB', { month: 'long' })

    const [targets, commissions] = await Promise.all([
      getMonthlyTargets(year, month),
      getCommissionData(year),
    ])

    return NextResponse.json({
      success: true,
      data: { targets, commissions },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Targets API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch targets', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
