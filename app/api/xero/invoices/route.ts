import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, checkReadRateLimit, checkRefreshCooldown, checkOrgRateLimit } from '@/lib/api-auth'
import { getEnrichedOverdueInvoices, getInvoicesByStatus } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/invoices — Get overdue invoices enriched with chase data
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireFinanceUser(request)
    await checkReadRateLimit(ctx.email)
    await checkOrgRateLimit()

    const { searchParams } = request.nextUrl
    const view = searchParams.get('view') || 'overdue'
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (view === 'overdue') {
      // Enforce cooldown on force-refresh to prevent Xero API abuse
      if (forceRefresh) {
        await checkRefreshCooldown(ctx.email)
      }
      const result = await getEnrichedOverdueInvoices(forceRefresh)
      return NextResponse.json({
        success: true,
        data: result.invoices,
        stale: result.stale,
        truncated: result.truncated,
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
