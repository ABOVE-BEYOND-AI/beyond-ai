import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, checkReadRateLimit } from '@/lib/api-auth'
import { getPaymentPlanInvoices } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/payment-plans — Get partially paid invoices (payment plans)
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireFinanceUser(request)
    await checkReadRateLimit(ctx.email)
    const { plans, truncated } = await getPaymentPlanInvoices()
    return NextResponse.json({ success: true, data: plans, truncated })
  } catch (error) {
    console.error('Payment plans error:', error)
    return apiErrorResponse(error, 'Failed to fetch payment plans')
  }
}
