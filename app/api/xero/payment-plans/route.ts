import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getPaymentPlanInvoices } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/payment-plans — Get partially paid invoices (payment plans)
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const plans = await getPaymentPlanInvoices()
    return NextResponse.json({ success: true, data: plans })
  } catch (error) {
    console.error('Payment plans error:', error)
    return apiErrorResponse(error, 'Failed to fetch payment plans')
  }
}
