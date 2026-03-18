import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { decodeSession } from '@/lib/google-oauth-clean'
import { chargeCustomerCard, isStripeConfigured } from '@/lib/stripe'
import { recordPayment, addChaseActivity, getBankAccounts } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/stripe/charge — Charge a saved Stripe card and record on Xero
export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)

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

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    const session = decodeSession(request.cookies.get('beyond_ai_session')?.value || '')
    const userEmail = session?.user?.email || 'unknown'

    // Convert pounds to pence
    const amountPence = Math.round(amount * 100)

    // Charge the card via Stripe
    const result = await chargeCustomerCard({
      customerId,
      paymentMethodId,
      amountPence,
      currency: 'gbp',
      description: `Invoice ${invoiceNumber} - ${contactName}`,
      invoiceReference: invoiceNumber,
      idempotencyKey: `charge-${invoiceId}-${Date.now()}`,
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        requiresAction: result.requiresAction,
      }, { status: 402 })
    }

    // Payment succeeded — record on Xero
    try {
      const bankAccounts = await getBankAccounts()
      if (bankAccounts.length > 0) {
        const today = new Date().toISOString().split('T')[0]
        await recordPayment(invoiceId, amount, bankAccounts[0].AccountID, today)
      }
    } catch (err) {
      console.error('Failed to auto-record payment on Xero (Stripe charge succeeded):', err)
      // Don't fail the response — the Stripe charge already went through
    }

    // Log activity
    await addChaseActivity(invoiceId, {
      action: 'payment_recorded',
      detail: `Stripe payment of £${amount.toFixed(2)} charged successfully`,
      user: userEmail,
    })

    return NextResponse.json({
      success: true,
      data: {
        paymentIntentId: result.paymentIntentId,
        stripeChargeSucceeded: true,
        xeroRecorded: true,
      },
    })
  } catch (error) {
    console.error('Stripe charge error:', error)
    return apiErrorResponse(error, 'Failed to process payment')
  }
}
