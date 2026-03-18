import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, validateUUID, checkRateLimit, validateCsrf, checkOrgRateLimit } from '@/lib/api-auth'
import { sendInvoiceEmail, addChaseActivity, getInvoice, getContact } from '@/lib/xero'
import { checkReminderCooldown } from '@/lib/finance-operations'

export const dynamic = 'force-dynamic'

// POST /api/xero/invoices/[id]/email — Send invoice reminder email via Xero
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    validateCsrf(request)
    const ctx = await requireFinanceUser(request)
    await checkRateLimit(ctx.email)
    await checkOrgRateLimit()

    const { id } = await params
    validateUUID(id, 'Invoice ID')

    // Pre-validate: fetch invoice and check it's still overdue/unpaid
    const invoice = await getInvoice(id)
    if (invoice.Status !== 'AUTHORISED' || invoice.AmountDue <= 0) {
      return NextResponse.json(
        { error: 'Cannot send reminder: invoice is not outstanding or has no balance due' },
        { status: 400 }
      )
    }

    // Check that the invoice is actually overdue (DueDate < today)
    const dueDate = new Date(invoice.DueDate)
    if (isNaN(dueDate.getTime()) || dueDate >= new Date()) {
      return NextResponse.json(
        { error: 'Cannot send reminder: invoice is not yet overdue' },
        { status: 400 }
      )
    }

    // Verify contact has an email address
    try {
      const contact = await getContact(invoice.Contact.ContactID)
      const contactEmail = contact.EmailAddress || contact.ContactPersons?.[0]?.EmailAddress
      if (!contactEmail) {
        return NextResponse.json(
          { error: 'Cannot send reminder: contact has no email address' },
          { status: 400 }
        )
      }
    } catch {
      // If contact lookup fails, let Xero handle it
    }

    // Per-invoice cooldown — prevent spamming the same client
    const allowed = await checkReminderCooldown(id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'A reminder was sent recently for this invoice. Please wait before sending another.' },
        { status: 429 }
      )
    }

    await sendInvoiceEmail(id)

    // Log the action — best-effort
    try {
      await addChaseActivity(id, {
        action: 'email_sent',
        detail: 'Reminder email sent via Xero',
        user: ctx.email,
      })
    } catch (err) {
      console.error('Failed to log email activity (non-blocking):', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send email error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to send reminder email')
  }
}
