import { NextRequest, NextResponse } from 'next/server'
import { getPaymentPlanProgress } from '@/lib/salesforce'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const paymentPlans = await getPaymentPlanProgress()

    return NextResponse.json({
      success: true,
      data: paymentPlans,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
    })
  } catch (error) {
    console.error('Payments API error:', error)
    return apiErrorResponse(error, 'Failed to fetch payment plans')
  }
}
