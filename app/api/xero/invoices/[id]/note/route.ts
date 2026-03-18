import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, validateUUID, checkRateLimit, validateCsrf } from '@/lib/api-auth'
import { addInvoiceNote, addChaseActivity } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/xero/invoices/[id]/note — Add note to invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    validateCsrf(request)
    const ctx = await requireFinanceUser(request)
    await checkRateLimit(ctx.email)

    const { id } = await params
    validateUUID(id, 'Invoice ID')

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

    // Write to Xero first (source of truth), then Redis activity log
    // Sequential to ensure Xero succeeds before logging locally
    await addInvoiceNote(id, sanitizedNote)

    // Redis activity log is best-effort — don't fail the request if this errors
    try {
      await addChaseActivity(id, {
        action: 'note',
        detail: sanitizedNote,
        user: ctx.email,
      })
    } catch (err) {
      console.error('Failed to log note activity to Redis (non-blocking):', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Add note error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to add note')
  }
}
