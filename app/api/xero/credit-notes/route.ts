import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceUser, apiErrorResponse, validateUUID, checkReadRateLimit } from '@/lib/api-auth'
import { getCreditNotesForContact, getAllCreditNotes } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/credit-notes?contactId=xxx — Get credit notes
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireFinanceUser(request)
    await checkReadRateLimit(ctx.email)

    const contactId = request.nextUrl.searchParams.get('contactId')

    if (contactId) {
      validateUUID(contactId, 'Contact ID')
      const creditNotes = await getCreditNotesForContact(contactId)
      return NextResponse.json({ success: true, data: creditNotes })
    }

    const creditNotes = await getAllCreditNotes()
    return NextResponse.json({ success: true, data: creditNotes })
  } catch (error) {
    console.error('Credit notes error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to fetch credit notes')
  }
}
