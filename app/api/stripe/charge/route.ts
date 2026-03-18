import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, validateUUID, checkRateLimit, validateCsrf, checkOrgRateLimit } from '@/lib/api-auth'
import { chargeCustomerCard, isStripeConfigured, findUniqueCustomerByEmail } from '@/lib/stripe'
import { recordPayment, addChaseActivity, getInvoice, getContact, roundCurrency, invalidateFinanceCaches } from '@/lib/xero'
import { acquireOperationLock, releaseOperationLock, getCompletedOperation, recordCompletedOperation, getStripeContactMapping, setStripeContactMapping } from '@/lib/finance-operations'

export const dynamic = 'force-dynamic'

function getStripeBankAccountId(): string | null {
  return process.env.STRIPE_XERO_BANK_ACCOUNT_ID || null
}

// POST /api/stripe/charge — Charge a saved Stripe card and record on Xero
export async function POST(request: NextRequest) {
  try {
    validateCsrf(request)
    const ctx = await requireFinanceUser(request)
    await checkRateLimit(ctx.email)
    await checkOrgRateLimit()

    if (!isStripeConfigured()) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { customerId, paymentMethodId, amount, invoiceId, invoiceNumber, contactName } = body as {
      customerId: string
      paymentMethodId: string
      amount: number
      invoiceId: string
      invoiceNumber: string
      contactName: string
    }

    if (!customerId || !paymentMethodId || !amount || !invoiceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    validateUUID(invoiceId, 'Invoice ID')

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    if (amount > 100000) {
      return NextResponse.json({ error: 'Amount exceeds maximum (£100,000)' }, { status: 400 })
    }

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

    // ── Verify Stripe customer belongs to the invoice contact ──
    // Use stored mapping first; fall back to email lookup with ambiguity rejection.
    const contactId = invoice.Contact.ContactID
    let expectedCustomerId = await getStripeContactMapping(contactId)

    if (!expectedCustomerId) {
      // No stored mapping — derive from contact email
      const contact = await getContact(contactId)
      const contactEmail = contact.EmailAddress || contact.ContactPersons?.[0]?.EmailAddress
      if (!contactEmail) {
        return NextResponse.json({ error: 'Invoice contact has no email — cannot verify Stripe customer' }, { status: 400 })
      }

      const stripeCustomer = await findUniqueCustomerByEmail(contactEmail)
      if (!stripeCustomer) {
        return NextResponse.json({ error: 'No Stripe customer found for this contact' }, { status: 400 })
      }

      expectedCustomerId = stripeCustomer.customerId
      // Store the verified mapping for future lookups
      await setStripeContactMapping(contactId, expectedCustomerId)
    }

    if (expectedCustomerId !== customerId) {
      return NextResponse.json({ error: 'Stripe customer does not match the invoice contact' }, { status: 400 })
    }

    // Convert pounds to pence
    const amountPence = Math.round(requestedAmount * 100)

    // Idempotency key for the full Stripe + Xero operation
    const idempotencyKey = `charge:${invoiceId}:${amountPence}:${paymentMethodId}`

    // Check if this exact charge was already completed (prevents Xero double-recording)
    const existing = await getCompletedOperation(idempotencyKey)
    if (existing) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        data: existing.data,
      })
    }

    // Acquire per-invoice lock
    const locked = await acquireOperationLock('charge', invoiceId)
    if (!locked) {
      return NextResponse.json(
        { error: 'Another charge is being processed for this invoice. Please wait.' },
        { status: 409 }
      )
    }

    let result
    try {
      // Charge the card via Stripe (Stripe-level idempotency via key)
      result = await chargeCustomerCard({
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

      // Payment succeeded — record on Xero
      let xeroRecorded = false
      let xeroError: string | undefined
      try {
        const bankAccountId = getStripeBankAccountId()
        if (!bankAccountId) {
          throw new Error('STRIPE_XERO_BANK_ACCOUNT_ID not configured')
        }
        const today = new Date().toISOString().split('T')[0]
        await recordPayment(invoiceId, requestedAmount, bankAccountId, today)
        xeroRecorded = true
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`CRITICAL: Stripe charge ${result.paymentIntentId} succeeded but Xero recording FAILED for invoice ${invoiceId}: ${errMsg}`)
        xeroError = 'Payment charged successfully but could not be recorded in Xero. Please record manually.'
      }

      // Record completed operation for idempotency
      await recordCompletedOperation(idempotencyKey, {
        success: true,
        completedAt: new Date().toISOString(),
        data: {
          paymentIntentId: result.paymentIntentId,
          xeroRecorded,
          xeroError,
        },
      })

      await invalidateFinanceCaches()

      // Log activity — best-effort
      try {
        const activityDetail = xeroRecorded
          ? `Stripe payment of £${requestedAmount.toFixed(2)} charged and recorded`
          : `Stripe payment of £${requestedAmount.toFixed(2)} charged (WARNING: Xero recording failed — record manually)`

        await addChaseActivity(invoiceId, {
          action: 'payment_recorded',
          detail: activityDetail,
          user: ctx.email,
        })
      } catch (err) {
        console.error('Failed to log charge activity (non-blocking):', err)
      }

      return NextResponse.json({
        success: true,
        data: {
          paymentIntentId: result.paymentIntentId,
          stripeChargeSucceeded: true,
          xeroRecorded,
          xeroError,
        },
      })
    } finally {
      await releaseOperationLock('charge', invoiceId)
    }
  } catch (error) {
    console.error('Stripe charge error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to process payment')
  }
}
