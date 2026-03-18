import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { decodeSession } from '@/lib/google-oauth-clean'
import { allocateCreditToInvoice, addChaseActivity } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/xero/credit-notes/[id]/allocate — Apply credit note to invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id: creditNoteId } = await params
    const body = await request.json()
    const { invoiceId, amount, date } = body as {
      invoiceId: string
      amount: number
      date: string
    }

    if (!invoiceId || !amount || !date) {
      return NextResponse.json({ error: 'Missing required fields: invoiceId, amount, date' }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    if (amount > 1000000) {
      return NextResponse.json({ error: 'Amount exceeds maximum' }, { status: 400 })
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
    }

    const session = decodeSession(request.cookies.get('beyond_ai_session')?.value || '')
    const userEmail = session?.user?.email || 'unknown'

    await allocateCreditToInvoice(creditNoteId, invoiceId, amount, date)

    // Log activity
    await addChaseActivity(invoiceId, {
      action: 'payment_recorded',
      detail: `Credit of £${amount.toFixed(2)} applied from credit note`,
      user: userEmail,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Credit allocation error:', error)
    return apiErrorResponse(error, 'Failed to allocate credit')
  }
}
