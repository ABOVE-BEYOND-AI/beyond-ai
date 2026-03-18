import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse, validateUUID } from '@/lib/api-auth'
import { getContact } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/contacts/[id] — Get contact details with email
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(request)
    const { id } = await params
    validateUUID(id, 'Contact ID')

    const contact = await getContact(id)
    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    console.error('Contact fetch error:', error instanceof Error ? error.message : error)
    return apiErrorResponse(error, 'Failed to fetch contact')
  }
}
