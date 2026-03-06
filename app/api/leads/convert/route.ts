import { NextRequest, NextResponse } from 'next/server'
import { convertLead } from '@/lib/salesforce'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
    const body = await request.json()
    const { leadId } = body

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    const result = await convertLead(leadId)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Lead conversion error:', error)
    return apiErrorResponse(error, 'Failed to convert lead')
  }
}
