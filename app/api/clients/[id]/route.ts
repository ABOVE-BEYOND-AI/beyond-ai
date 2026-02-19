import { NextRequest, NextResponse } from 'next/server'
import { getContactDetail, getContactOpportunities, getContactNotes } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [contact, opportunities, notes] = await Promise.all([
      getContactDetail(id),
      getContactOpportunities(id),
      getContactNotes(id),
    ])

    // Compute lifetime stats
    const lifetimeValue = opportunities.reduce((sum, o) => sum + (o.Gross_Amount__c ?? o.Amount ?? 0), 0)
    const wonOpps = opportunities.filter(o => ['Agreement Signed', 'Amended', 'Amendment Signed'].includes(o.StageName))
    const totalBookings = wonOpps.length

    // Group opportunities by year
    const oppsByYear: Record<string, typeof opportunities> = {}
    for (const opp of opportunities) {
      const year = opp.CloseDate?.split('-')[0] || 'Unknown'
      if (!oppsByYear[year]) oppsByYear[year] = []
      oppsByYear[year].push(opp)
    }

    return NextResponse.json({
      success: true,
      data: {
        contact,
        opportunities,
        notes,
        lifetimeValue,
        totalBookings,
        oppsByYear,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Client detail API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch client details', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
