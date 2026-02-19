import { NextResponse } from 'next/server'
import { getEventsWithInventory } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const events = await getEventsWithInventory()

    return NextResponse.json({ success: true, data: events }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Events inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events inventory', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
