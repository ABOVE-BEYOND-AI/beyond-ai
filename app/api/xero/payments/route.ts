import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse, validateUUID, validateDateString, checkRateLimit, validateCsrf } from '@/lib/api-auth'
import { recordPayment, addChaseActivity, getInvoice, roundCurrency } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/xero/payments — Record a payment against an invoice
export async function POST(request: NextRequest) {
  try {
    validateCsrf(request)
    const ctx = await requireApiUser(request)
    await checkRateLimit(ctx.email)

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

    // Validate ID formats
    validateUUID(invoiceId, 'Invoice ID')
    validateUUID(bankAccountId, 'Bank Account ID')

    // Validate amount
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    if (amount > 1000000) {
      return NextResponse.json({ error: 'Amount exceeds maximum (£1,000,000)' }, { status: 400 })
    }

    // Validate date format and range (max 90 days in past, 1 day in future)
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

    await recordPayment(invoiceId, requestedAmount, bankAccountId, date)

    // Log the action
    await addChaseActivity(invoiceId, {
      action: 'payment_recorded',
      detail: `Payment of £${requestedAmount.toFixed(2)} recorded`,
      user: ctx.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Record payment error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to record payment')
  }
}
