import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { findCustomerByEmail, getCustomerPaymentMethods, isStripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// GET /api/stripe/customer?email=xxx — Find Stripe customer and their saved cards
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)

    if (!isStripeConfigured()) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 })
    }

    const email = request.nextUrl.searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    const customer = await findCustomerByEmail(email)
    if (!customer) {
      return NextResponse.json({ success: true, data: { found: false, customer: null, paymentMethods: [] } })
    }

    const paymentMethods = await getCustomerPaymentMethods(customer.customerId)

    return NextResponse.json({
      success: true,
      data: {
        found: true,
        customer,
        paymentMethods,
      },
    })
  } catch (error) {
    console.error('Stripe customer lookup error:', error)
    return apiErrorResponse(error, 'Failed to find Stripe customer')
  }
}
