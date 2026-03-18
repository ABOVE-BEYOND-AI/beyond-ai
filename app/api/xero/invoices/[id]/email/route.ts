import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { decodeSession } from '@/lib/google-oauth-clean'
import { sendInvoiceEmail, addChaseActivity } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// POST /api/xero/invoices/[id]/email — Send invoice reminder email via Xero
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id } = await params

    const session = decodeSession(request.cookies.get('beyond_ai_session')?.value || '')
    const userEmail = session?.user?.email || 'unknown'

    await sendInvoiceEmail(id)

    // Log the action
    await addChaseActivity(id, {
      action: 'email_sent',
      detail: 'Reminder email sent via Xero',
      user: userEmail,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send email error:', error)
    return apiErrorResponse(error, 'Failed to send reminder email')
  }
}
