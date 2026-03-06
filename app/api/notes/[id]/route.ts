import { NextRequest, NextResponse } from 'next/server'
import { getNoteById, updateNote, deleteNote } from '@/lib/salesforce'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id } = await params
    const note = await getNoteById(id)
    return NextResponse.json({ success: true, data: note })
  } catch (error) {
    console.error('Get note error:', error)
    return apiErrorResponse(error, 'Failed to fetch note')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id } = await params
    const body = await request.json()
    const { content } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Note content is required' },
        { status: 400 }
      )
    }

    await updateNote(id, content.trim())
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update note error:', error)
    return apiErrorResponse(error, 'Failed to update note')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id } = await params
    await deleteNote(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete note error:', error)
    return apiErrorResponse(error, 'Failed to delete note')
  }
}
