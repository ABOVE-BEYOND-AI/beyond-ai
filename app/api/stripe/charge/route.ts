import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse, validateUUID, checkRateLimit, validateCsrf } from '@/lib/api-auth'
import { chargeCustomerCard, isStripeConfigured } from '@/lib/stripe'
import { recordPayment, addChaseActivity, getInvoice, roundCurrency } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// Configured Stripe-linked bank account for auto-recording payments on Xero.
// Falls back to STRIPE_XERO_BANK_ACCOUNT_ID env var — must be set in production.
function getStripeBankAccountId(): string | null {
  return process.env.STRIPE_XERO_BANK_ACCOUNT_ID || null
}

// POST /api/stripe/charge — Charge a saved Stripe card and record on Xero
export async function POST(request: NextRequest) {
  try {
    validateCsrf(request)
    const ctx = await requireApiUser(request)
    await checkRateLimit(ctx.email)

    if (!isStripeConfigured()) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { customerId, paymentMethodId, amount, invoiceId, invoiceNumber, contactName } = body as {
      customerId: string
      paymentMethodId: string
      amount: number // in pounds
      invoiceId: string
      invoiceNumber: string
      contactName: string
    }

    if (!customerId || !paymentMethodId || !amount || !invoiceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate ID formats
    validateUUID(invoiceId, 'Invoice ID')

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    if (amount > 100000) {
      return NextResponse.json({ error: 'Amount exceeds maximum (£100,000)' }, { status: 400 })
    }

    // CRITICAL: Validate amount against actual invoice balance to prevent overcharging
    const invoice = await getInvoice(invoiceId)
    const invoiceBalance = roundCurrency(invoice.AmountDue)
    const requestedAmount = roundCurrency(amount)

    if (requestedAmount > invoiceBalance) {
      return NextResponse.json({
        error: `Amount £${requestedAmount.toFixed(2)} exceeds invoice balance of £${invoiceBalance.toFixed(2)}`,
      }, { status: 400 })
    }

    // Convert pounds to pence — use roundCurrency first to avoid floating point issues
    const amountPence = Math.round(requestedAmount * 100)

    // Deterministic idempotency key: same invoice + amount + payment method = same key
    // Prevents double-charges from double-clicks or retries
    // Changes if amount or card is different (legitimate new attempt)
    const idempotencyKey = `charge-${invoiceId}-${amountPence}-${paymentMethodId}`

    // Charge the card via Stripe
    const result = await chargeCustomerCard({
      customerId,
      paymentMethodId,
      amountPence,
      currency: 'gbp',
      description: `Invoice ${invoiceNumber} - ${contactName}`,
      invoiceReference: invoiceNumber,
      idempotencyKey,
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        requiresAction: result.requiresAction,
      }, { status: 402 })
    }

    // Payment succeeded — record on Xero using configured bank account
    let xeroRecorded = false
    let xeroError: string | undefined
    try {
      const bankAccountId = getStripeBankAccountId()
      if (!bankAccountId) {
        throw new Error('STRIPE_XERO_BANK_ACCOUNT_ID not configured — cannot auto-record payment')
      }
      const today = new Date().toISOString().split('T')[0]
      await recordPayment(invoiceId, requestedAmount, bankAccountId, today)
      xeroRecorded = true
    } catch (err) {
      // CRITICAL: Stripe charge succeeded but Xero recording failed
      // Log with high severity so this can be monitored/alerted
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`CRITICAL: Stripe charge ${result.paymentIntentId} succeeded but Xero recording FAILED for invoice ${invoiceId}: ${errMsg}`)
      xeroError = 'Payment charged successfully but could not be recorded in Xero. Please record manually.'
    }

    // Log activity
    const activityDetail = xeroRecorded
      ? `Stripe payment of £${requestedAmount.toFixed(2)} charged and recorded`
      : `Stripe payment of £${requestedAmount.toFixed(2)} charged (WARNING: Xero recording failed — record manually)`

    await addChaseActivity(invoiceId, {
      action: 'payment_recorded',
      detail: activityDetail,
      user: ctx.email,
    })

    return NextResponse.json({
      success: true,
      data: {
        paymentIntentId: result.paymentIntentId,
        stripeChargeSucceeded: true,
        xeroRecorded,
        xeroError,
      },
    })
  } catch (error) {
    console.error('Stripe charge error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to process payment')
  }
}
