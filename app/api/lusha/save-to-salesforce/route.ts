import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { updateRecord } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

/** Fields that can be written back to Salesforce from Lusha enrichment */
interface EnrichmentData {
  email?: string
  phone?: string
  title?: string
  company?: string
  linkedin?: string
}

/** POST /api/lusha/save-to-salesforce — Write enriched data back to a Lead or Contact in Salesforce */
export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)

    const body = await request.json()
    const { recordType, recordId, data } = body as {
      recordType?: string
      recordId?: string
      data?: EnrichmentData
    }

    if (!recordType || (recordType !== 'Lead' && recordType !== 'Contact')) {
      return NextResponse.json(
        { success: false, error: 'recordType must be "Lead" or "Contact"' },
        { status: 400 }
      )
    }

    if (!recordId || typeof recordId !== 'string' || recordId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'recordId is required' },
        { status: 400 }
      )
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'data object is required' },
        { status: 400 }
      )
    }

    const fields: Record<string, unknown> = {}

    if (data.email) fields.Email = data.email
    if (data.phone) fields.MobilePhone = data.phone
    if (data.title) fields.Title = data.title
    if (data.company && recordType === 'Lead') fields.Company = data.company
    if (data.linkedin) fields.LinkedIn__c = data.linkedin

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    await updateRecord(recordType, recordId.trim(), fields)

    return NextResponse.json({
      success: true,
      data: {
        recordType,
        recordId: recordId.trim(),
        fieldsUpdated: Object.keys(fields),
      },
    })
  } catch (error) {
    console.error('Lusha save-to-salesforce error:', error)
    return apiErrorResponse(error, 'Failed to save enrichment data to Salesforce')
  }
}
