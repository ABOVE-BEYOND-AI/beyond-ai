import { NextRequest, NextResponse } from 'next/server'
import { getOpenOpportunities, updateOpportunityStage } from '@/lib/salesforce'
import type { PipelineFilters } from '@/lib/salesforce-types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const filters: PipelineFilters = {}
    if (searchParams.get('ownerId')) filters.ownerId = searchParams.get('ownerId')!
    if (searchParams.get('eventId')) filters.eventId = searchParams.get('eventId')!
    if (searchParams.get('eventCategory')) filters.eventCategory = searchParams.get('eventCategory')!
    if (searchParams.get('minAmount')) filters.minAmount = Number(searchParams.get('minAmount'))
    if (searchParams.get('maxAmount')) filters.maxAmount = Number(searchParams.get('maxAmount'))
    if (searchParams.get('includeClosed') === 'true') filters.includeClosed = true

    const opportunities = await getOpenOpportunities(filters)

    return NextResponse.json({ success: true, data: opportunities }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (error) {
    console.error('Pipeline API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, stage } = body

    if (!id || !stage) {
      return NextResponse.json({ error: 'Missing id or stage' }, { status: 400 })
    }

    await updateOpportunityStage(id, stage)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Pipeline update error:', error)
    return NextResponse.json(
      { error: 'Failed to update opportunity', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
