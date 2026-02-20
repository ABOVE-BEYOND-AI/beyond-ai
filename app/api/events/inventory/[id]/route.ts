import { NextRequest, NextResponse } from 'next/server'
import { getEventOpportunities } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing event ID' }, { status: 400 })
    }

    const opportunities = await getEventOpportunities(id)

    return NextResponse.json({ success: true, data: opportunities }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Event detail API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event detail', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
