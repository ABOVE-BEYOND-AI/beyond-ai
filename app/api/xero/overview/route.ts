import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, checkReadRateLimit } from '@/lib/api-auth'
import { getOverdueSummary } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/overview — Dashboard summary stats
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireFinanceUser(request)
    await checkReadRateLimit(ctx.email)
    const summary = await getOverdueSummary()
    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('Xero overview error:', error)
    return apiErrorResponse(error, 'Failed to fetch overview')
  }
}
