import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getInvoice, getContact, getInvoiceHistory, getChaseStage, getChaseActivities } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/invoices/[id] — Get single invoice with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id } = await params

    const invoice = await getInvoice(id)

    // Fetch contact details, history, and chase data in parallel
    const [contact, xeroHistory, chaseStage, activities] = await Promise.all([
      getContact(invoice.Contact.ContactID).catch(() => null),
      getInvoiceHistory(id).catch(() => []),
      getChaseStage(id),
      getChaseActivities(id),
    ])

    const dueDate = new Date(invoice.DueDate)
    const daysOverdue = invoice.Status === 'AUTHORISED' && invoice.AmountDue > 0
      ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    return NextResponse.json({
      success: true,
      data: {
        invoice,
        contact,
        xeroHistory,
        chaseStage,
        activities,
        daysOverdue: Math.max(0, daysOverdue),
      },
    })
  } catch (error) {
    console.error('Xero invoice detail error:', error)
    return apiErrorResponse(error, 'Failed to fetch invoice details')
  }
}
