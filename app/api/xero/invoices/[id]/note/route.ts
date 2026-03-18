import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { decodeSession } from '@/lib/google-oauth-clean'
import { addInvoiceNote, addChaseActivity } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/xero/invoices/[id]/note — Add note to invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id } = await params
    const body = await request.json()
    const { note } = body as { note: string }

    if (!note?.trim()) {
      return NextResponse.json({ error: 'Note text required' }, { status: 400 })
    }

    const MAX_NOTE_LENGTH = 1000
    const sanitizedNote = note.trim().slice(0, MAX_NOTE_LENGTH)

    if (sanitizedNote.length === 0) {
      return NextResponse.json({ error: 'Note text required' }, { status: 400 })
    }

    const session = decodeSession(request.cookies.get('beyond_ai_session')?.value || '')
    const userEmail = session?.user?.email || 'unknown'

    // Add to both Xero History and local Redis activity log
    await Promise.all([
      addInvoiceNote(id, sanitizedNote),
      addChaseActivity(id, {
        action: 'note',
        detail: sanitizedNote,
        user: userEmail,
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Add note error:', error)
    return apiErrorResponse(error, 'Failed to add note')
  }
}
