import { NextRequest, NextResponse } from 'next/server'
import { getContacts } from '@/lib/salesforce'
import type { ClientFilters } from '@/lib/salesforce-types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const filters: ClientFilters = {}
    if (searchParams.get('search')) filters.search = searchParams.get('search')!
    if (searchParams.get('ownerId')) filters.ownerId = searchParams.get('ownerId')!
    if (searchParams.get('minSpend')) filters.minSpend = Number(searchParams.get('minSpend'))

    const contacts = await getContacts(filters)

    return NextResponse.json({ success: true, data: contacts }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Clients API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch clients', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
