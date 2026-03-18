import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
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
    const contact = await getContact(id)
    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    console.error('Contact fetch error:', error)
    return apiErrorResponse(error, 'Failed to fetch contact')
  }
}
