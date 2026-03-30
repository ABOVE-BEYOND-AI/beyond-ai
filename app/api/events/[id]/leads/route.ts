import { NextRequest, NextResponse } from 'next/server'
import { getLeadsForEvent, query } from '@/lib/salesforce'

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

    // Lightweight query to get event name and category
    const eventResult = await query<{ Name: string; Category__c: string | null }>(
      `SELECT Name, Category__c FROM Event__c WHERE Id = '${id}' LIMIT 1`
    )

    if (eventResult.records.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const event = eventResult.records[0]
    const leads = await getLeadsForEvent(event.Name, event.Category__c)

    return NextResponse.json({ success: true, data: leads, eventName: event.Name, category: event.Category__c }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (error) {
    console.error('Event leads API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event leads', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
