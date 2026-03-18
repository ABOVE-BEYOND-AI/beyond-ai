import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, validateUUID, validateDateString, checkRateLimit, validateCsrf, checkOrgRateLimit } from '@/lib/api-auth'
import { recordPayment, addChaseActivity, getInvoice, roundCurrency, invalidateFinanceCaches } from '@/lib/xero'
import { acquireOperationLock, releaseOperationLock, getCompletedOperation, recordCompletedOperation } from '@/lib/finance-operations'

export const dynamic = 'force-dynamic'

// POST /api/xero/payments — Record a payment against an invoice
export async function POST(request: NextRequest) {
  try {
    validateCsrf(request)
    const ctx = await requireFinanceUser(request)
    await checkRateLimit(ctx.email)
    await checkOrgRateLimit()

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

    validateUUID(invoiceId, 'Invoice ID')
    validateUUID(bankAccountId, 'Bank Account ID')

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    if (amount > 1000000) {
      return NextResponse.json({ error: 'Amount exceeds maximum (£1,000,000)' }, { status: 400 })
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

    if (invoice.CurrencyCode && invoice.CurrencyCode !== 'GBP') {
      return NextResponse.json({
        error: `Non-GBP invoices (${invoice.CurrencyCode}) are not supported yet`,
      }, { status: 400 })
    }

    // Idempotency: check if this exact operation was already completed
    const idempotencyKey = `payment:${invoiceId}:${requestedAmount}:${bankAccountId}:${date}`
    const existing = await getCompletedOperation(idempotencyKey)
    if (existing) {
      return NextResponse.json({ success: true, idempotent: true })
    }

    // Acquire per-invoice lock to prevent concurrent payment recording
    const locked = await acquireOperationLock('payment', invoiceId)
    if (!locked) {
      return NextResponse.json(
        { error: 'Another payment is being processed for this invoice. Please wait.' },
        { status: 409 }
      )
    }

    try {
      await recordPayment(invoiceId, requestedAmount, bankAccountId, date)
      await recordCompletedOperation(idempotencyKey, { success: true, completedAt: new Date().toISOString() })
    } finally {
      await releaseOperationLock('payment', invoiceId)
    }

    await invalidateFinanceCaches()

    try {
      await addChaseActivity(invoiceId, {
        action: 'payment_recorded',
        detail: `Payment of £${requestedAmount.toFixed(2)} recorded`,
        user: ctx.email,
      })
    } catch (err) {
      console.error('Failed to log payment activity (non-blocking):', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Record payment error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to record payment')
  }
}
