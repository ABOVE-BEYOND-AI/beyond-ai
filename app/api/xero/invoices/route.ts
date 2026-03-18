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

    if (view === 'overdue') {
      const invoices = await getEnrichedOverdueInvoices()
      return NextResponse.json({ success: true, data: invoices })
    }

    // Other views: authorised, paid, etc.
    const invoices = await getInvoicesByStatus(view.toUpperCase())
    return NextResponse.json({ success: true, data: invoices })
  } catch (error) {
    console.error('Xero invoices error:', error)
    return apiErrorResponse(error, 'Failed to fetch invoices')
  }
}
