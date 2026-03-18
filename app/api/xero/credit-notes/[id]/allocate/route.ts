import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, validateUUID, validateDateString, checkRateLimit, validateCsrf, checkOrgRateLimit } from '@/lib/api-auth'
import { allocateCreditToInvoice, addChaseActivity, getInvoice, roundCurrency, invalidateFinanceCaches } from '@/lib/xero'
import { acquireOperationLock, releaseOperationLock, getCompletedOperation, recordCompletedOperation } from '@/lib/finance-operations'

export const dynamic = 'force-dynamic'

// POST /api/xero/credit-notes/[id]/allocate — Apply credit note to invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    validateCsrf(request)
    const ctx = await requireFinanceUser(request)
    await checkRateLimit(ctx.email)
    await checkOrgRateLimit()

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

    validateDateString(date)

    const invoice = await getInvoice(invoiceId)
    const invoiceBalance = roundCurrency(invoice.AmountDue)
    const requestedAmount = roundCurrency(amount)

    if (requestedAmount > invoiceBalance) {
      return NextResponse.json({
        error: `Amount £${requestedAmount.toFixed(2)} exceeds invoice balance of £${invoiceBalance.toFixed(2)}`,
      }, { status: 400 })
    }

    // Idempotency check
    const idempotencyKey = `credit:${creditNoteId}:${invoiceId}:${requestedAmount}:${date}`
    const existing = await getCompletedOperation(idempotencyKey)
    if (existing) {
      return NextResponse.json({ success: true, idempotent: true })
    }

    // Acquire per-invoice lock
    const locked = await acquireOperationLock('credit', invoiceId)
    if (!locked) {
      return NextResponse.json(
        { error: 'Another credit operation is being processed for this invoice. Please wait.' },
        { status: 409 }
      )
    }

    try {
      await allocateCreditToInvoice(creditNoteId, invoiceId, requestedAmount, date)
      await recordCompletedOperation(idempotencyKey, { success: true, completedAt: new Date().toISOString() })
    } finally {
      await releaseOperationLock('credit', invoiceId)
    }

    await invalidateFinanceCaches()

    try {
      await addChaseActivity(invoiceId, {
        action: 'payment_recorded',
        detail: `Credit of £${requestedAmount.toFixed(2)} applied from credit note`,
        user: ctx.email,
      })
    } catch (err) {
      console.error('Failed to log credit allocation activity (non-blocking):', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Credit allocation error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to allocate credit')
  }
}
