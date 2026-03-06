import { NextRequest, NextResponse } from 'next/server'
import { getAllNotes, searchNotes, createNote, getContactsForPicker } from '@/lib/salesforce'
import type { NoteFilters } from '@/lib/salesforce-types'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const { searchParams } = new URL(request.url)

    // Contact picker mode
    if (searchParams.get('mode') === 'contacts') {
      const search = searchParams.get('search') || undefined
      const contacts = await getContactsForPicker(search)
      return NextResponse.json({ success: true, data: contacts })
    }

    const filters: NoteFilters = {}
    if (searchParams.get('contactId')) filters.contactId = searchParams.get('contactId')!
    if (searchParams.get('ownerId')) filters.ownerId = searchParams.get('ownerId')!
    if (searchParams.get('limit')) filters.limit = Number(searchParams.get('limit'))
    if (searchParams.get('offset')) filters.offset = Number(searchParams.get('offset'))

    const searchQuery = searchParams.get('search') || searchParams.get('q')

    let notes
    if (searchQuery && searchQuery.trim().length > 0) {
      notes = await searchNotes(searchQuery.trim(), filters)
    } else {
      filters.search = undefined
      notes = await getAllNotes(filters)
    }

    return NextResponse.json(
      { success: true, data: notes, count: notes.length },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    )
  } catch (error) {
    console.error('Notes API error:', error)
    return apiErrorResponse(error, 'Failed to fetch notes')
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
    const body = await request.json()
    const { contactId, content } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Note content is required' },
        { status: 400 }
      )
    }

    const noteId = await createNote(contactId || null, content.trim())

    return NextResponse.json({ success: true, data: { id: noteId } }, { status: 201 })
  } catch (error) {
    console.error('Create note error:', error)
    return apiErrorResponse(error, 'Failed to create note')
  }
}
