import { NextRequest, NextResponse } from 'next/server'
import { getLeads, updateLead } from '@/lib/salesforce'
import type { LeadFilters } from '@/lib/salesforce-types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const filters: LeadFilters = {}
    if (searchParams.get('status')) filters.status = searchParams.get('status')!
    if (searchParams.get('sourceGroup')) filters.sourceGroup = searchParams.get('sourceGroup')!
    if (searchParams.get('interest')) filters.interest = searchParams.get('interest')!
    if (searchParams.get('ownerId')) filters.ownerId = searchParams.get('ownerId')!
    if (searchParams.get('search')) filters.search = searchParams.get('search')!
    if (searchParams.get('view')) filters.view = searchParams.get('view') as LeadFilters['view']

    const leads = await getLeads(filters)

    return NextResponse.json({ success: true, data: leads }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (error) {
    console.error('Leads API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, fields } = body

    if (!id || !fields) {
      return NextResponse.json({ error: 'Missing id or fields' }, { status: 400 })
    }

    await updateLead(id, fields)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lead update error:', error)
    return NextResponse.json(
      { error: 'Failed to update lead', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
