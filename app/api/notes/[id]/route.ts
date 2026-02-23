import { NextRequest, NextResponse } from 'next/server'
import { getNoteById, updateNote, deleteNote } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const note = await getNoteById(id)
    return NextResponse.json({ success: true, data: note })
  } catch (error) {
    console.error('Get note error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch note'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    return NextResponse.json(
      { success: false, error: 'Failed to update note', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteNote(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete note error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete note', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}
