// Stripe payment processing for charging saved cards off-session
import Stripe from 'stripe'

let stripeClient: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured. Add it to your environment variables.')
    stripeClient = new Stripe(key, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion })
  }
  return stripeClient
}

// ── Types ──

export interface StripeCustomerMatch {
  customerId: string
  name: string | null
  email: string | null
}

export interface StripePaymentMethod {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

export interface StripeChargeResult {
  success: boolean
  paymentIntentId?: string
  status?: string
  error?: string
  requiresAction?: boolean
}

// ── Customer Lookup ──

export async function findCustomerByEmail(email: string): Promise<StripeCustomerMatch | null> {
  const stripe = getStripe()
  const result = await stripe.customers.list({ email, limit: 1 })
  if (!result.data.length) return null
  const customer = result.data[0]
  return {
    customerId: customer.id,
    name: customer.name ?? null,
    email: customer.email ?? null,
  }
}

// ── Payment Methods ──

export async function getCustomerPaymentMethods(customerId: string): Promise<StripePaymentMethod[]> {
  const stripe = getStripe()
  const methods = await stripe.customers.listPaymentMethods(customerId, { type: 'card', limit: 10 })

  // Get default payment method
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
  const defaultPm = typeof customer.invoice_settings?.default_payment_method === 'string'
    ? customer.invoice_settings.default_payment_method
    : customer.invoice_settings?.default_payment_method?.id

  return methods.data.map(pm => ({
    id: pm.id,
    brand: pm.card?.brand || 'unknown',
    last4: pm.card?.last4 || '????',
    expMonth: pm.card?.exp_month || 0,
    expYear: pm.card?.exp_year || 0,
    isDefault: pm.id === defaultPm,
  }))
}

// ── Charge Saved Card (Off-Session) ──

export async function chargeCustomerCard(params: {
  customerId: string
  paymentMethodId: string
  amountPence: number // Amount in PENCE (e.g., £59.20 = 5920)
  currency?: string
  description?: string
  invoiceReference?: string
  idempotencyKey?: string
}): Promise<StripeChargeResult> {
  const stripe = getStripe()

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: params.amountPence,
        currency: params.currency || 'gbp',
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        off_session: true,
        confirm: true,
        description: params.description || undefined,
        metadata: params.invoiceReference ? { xero_invoice: params.invoiceReference } : undefined,
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
    )

    if (paymentIntent.status === 'succeeded') {
      return { success: true, paymentIntentId: paymentIntent.id, status: 'succeeded' }
    }

    if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
      return {
        success: false,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        requiresAction: true,
        error: 'Customer authentication required. The customer needs to approve this payment in their banking app.',
      }
    }

    return {
      success: false,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      error: `Payment status: ${paymentIntent.status}`,
    }
  } catch (err: unknown) {
    const stripeErr = err as Stripe.errors.StripeError
    if (stripeErr.type === 'StripeCardError') {
      return {
        success: false,
        error: stripeErr.message || 'Card declined',
        status: 'failed',
      }
    }
    throw err
  }
}

// ── Check if Stripe is configured ──

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}
