import { NextResponse } from 'next/server'
import { getPaymentPlanProgress } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const paymentPlans = await getPaymentPlanProgress()

    return NextResponse.json({
      success: true,
      data: paymentPlans,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
    })
  } catch (error) {
    console.error('Payments API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment plans', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
