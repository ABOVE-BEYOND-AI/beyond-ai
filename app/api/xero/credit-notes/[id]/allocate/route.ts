import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse, validateUUID, validateDateString, checkRateLimit, validateCsrf } from '@/lib/api-auth'
import { allocateCreditToInvoice, addChaseActivity, getInvoice, roundCurrency } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/xero/credit-notes/[id]/allocate — Apply credit note to invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    validateCsrf(request)
    const ctx = await requireApiUser(request)
    await checkRateLimit(ctx.email)

    const { id: creditNoteId } = await params
    validateUUID(creditNoteId, 'Credit Note ID')

    const body = await request.json()
    const { invoiceId, amount, date } = body as {
      invoiceId: string
      amount: number
      date: string
    }

    if (!invoiceId || !amount || !date) {
      return NextResponse.json({ error: 'Missing required fields: invoiceId, amount, date' }, { status: 400 })
    }

    validateUUID(invoiceId, 'Invoice ID')

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    if (amount > 1000000) {
      return NextResponse.json({ error: 'Amount exceeds maximum' }, { status: 400 })
    }

    // Validate date format and range
    validateDateString(date)

    // Validate amount does not exceed invoice balance
    const invoice = await getInvoice(invoiceId)
    const invoiceBalance = roundCurrency(invoice.AmountDue)
    const requestedAmount = roundCurrency(amount)

    if (requestedAmount > invoiceBalance) {
      return NextResponse.json({
        error: `Amount £${requestedAmount.toFixed(2)} exceeds invoice balance of £${invoiceBalance.toFixed(2)}`,
      }, { status: 400 })
    }

    // Note: Xero will also validate that the amount does not exceed the credit note's
    // RemainingCredit on the server side. We validate the invoice balance here as the
    // primary check. If Xero rejects, the error will propagate via xeroFetch.

    await allocateCreditToInvoice(creditNoteId, invoiceId, requestedAmount, date)

    // Log activity
    await addChaseActivity(invoiceId, {
      action: 'payment_recorded',
      detail: `Credit of £${requestedAmount.toFixed(2)} applied from credit note`,
      user: ctx.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Credit allocation error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to allocate credit')
  }
}
