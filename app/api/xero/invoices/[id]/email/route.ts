import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse, validateUUID, checkRateLimit, validateCsrf } from '@/lib/api-auth'
import { sendInvoiceEmail, addChaseActivity } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/xero/invoices/[id]/email — Send invoice reminder email via Xero
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    validateCsrf(request)
    const ctx = await requireApiUser(request)
    await checkRateLimit(ctx.email)

    const { id } = await params
    validateUUID(id, 'Invoice ID')

    await sendInvoiceEmail(id)

    // Log the action
    await addChaseActivity(id, {
      action: 'email_sent',
      detail: 'Reminder email sent via Xero',
      user: ctx.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send email error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to send reminder email')
  }
}
