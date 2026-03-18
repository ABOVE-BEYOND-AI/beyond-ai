import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getOverdueSummary } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/overview — Dashboard summary stats
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const summary = await getOverdueSummary()
    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('Xero overview error:', error)
    return apiErrorResponse(error, 'Failed to fetch overview')
  }
}
