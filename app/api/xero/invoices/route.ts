import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getEnrichedOverdueInvoices, getInvoicesByStatus } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/invoices — Get overdue invoices enriched with chase data
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const { searchParams } = request.nextUrl
    const view = searchParams.get('view') || 'overdue'
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (view === 'overdue') {
      const result = await getEnrichedOverdueInvoices(forceRefresh)
      return NextResponse.json({
        success: true,
        data: result.invoices,
        stale: result.stale,
        cachedAt: result.cachedAt,
      })
    }

    // Other views: authorised, paid, etc. — status is validated inside getInvoicesByStatus
    const invoices = await getInvoicesByStatus(view)
    return NextResponse.json({ success: true, data: invoices })
  } catch (error) {
    console.error('Xero invoices error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to fetch invoices')
  }
}
