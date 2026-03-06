import { NextRequest, NextResponse } from 'next/server'
import { getContacts } from '@/lib/salesforce'
import type { ClientFilters } from '@/lib/salesforce-types'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const { searchParams } = new URL(request.url)

    const filters: ClientFilters = {}
    if (searchParams.get('search')) filters.search = searchParams.get('search')!
    if (searchParams.get('ownerId')) filters.ownerId = searchParams.get('ownerId')!
    if (searchParams.get('minSpend')) filters.minSpend = Number(searchParams.get('minSpend'))
    if (searchParams.get('maxSpend')) filters.maxSpend = Number(searchParams.get('maxSpend'))
    if (searchParams.get('sortBy')) filters.sortBy = searchParams.get('sortBy') as ClientFilters['sortBy']
    if (searchParams.get('view')) filters.view = searchParams.get('view') as ClientFilters['view']
    if (searchParams.get('interests')) filters.interests = searchParams.get('interests')!
    if (searchParams.get('noteKeyword')) filters.noteKeyword = searchParams.get('noteKeyword')!

    const contacts = await getContacts(filters)

    return NextResponse.json({ success: true, data: contacts }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Clients API error:', error)
    return apiErrorResponse(error, 'Failed to fetch clients')
  }
}
