import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { decodeSession } from '@/lib/google-oauth-clean'
import { recordPayment, addChaseActivity } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/xero/payments — Record a payment against an invoice
export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
    const body = await request.json()
    const { invoiceId, amount, bankAccountId, date } = body as {
      invoiceId: string
      amount: number
      bankAccountId: string
      date: string
    }

    if (!invoiceId || !amount || !bankAccountId || !date) {
      return NextResponse.json({ error: 'Missing required fields: invoiceId, amount, bankAccountId, date' }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    const session = decodeSession(request.cookies.get('beyond_ai_session')?.value || '')
    const userEmail = session?.user?.email || 'unknown'

    await recordPayment(invoiceId, amount, bankAccountId, date)

    // Log the action
    await addChaseActivity(invoiceId, {
      action: 'payment_recorded',
      detail: `Payment of £${amount.toFixed(2)} recorded`,
      user: userEmail,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Record payment error:', error)
    return apiErrorResponse(error, 'Failed to record payment')
  }
}
