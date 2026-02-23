import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
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

/**
 * POST /api/lusha/save-to-salesforce — Write enriched data back to a Lead or Contact in Salesforce
 * Body: { recordType: 'Lead' | 'Contact', recordId: string, data: EnrichmentData }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('beyond_ai_session')?.value
    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const session = decodeSession(sessionCookie)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    const body = await request.json()
    const { recordType, recordId, data } = body as {
      recordType?: string
      recordId?: string
      data?: EnrichmentData
    }

    // Validate recordType
    if (!recordType || (recordType !== 'Lead' && recordType !== 'Contact')) {
      return NextResponse.json(
        { success: false, error: 'recordType must be "Lead" or "Contact"' },
        { status: 400 }
      )
    }

    // Validate recordId
    if (!recordId || typeof recordId !== 'string' || recordId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'recordId is required' },
        { status: 400 }
      )
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'data object is required' },
        { status: 400 }
      )
    }

    // Build Salesforce field map from enrichment data
    const fields: Record<string, unknown> = {}

    if (data.email) {
      fields.Email = data.email
    }
    if (data.phone) {
      // Use MobilePhone for both Leads and Contacts
      fields.MobilePhone = data.phone
    }
    if (data.title) {
      fields.Title = data.title
    }
    if (data.company && recordType === 'Lead') {
      // Company only applies to Leads (Contacts have Account)
      fields.Company = data.company
    }
    if (data.linkedin) {
      // Custom LinkedIn field (common in many orgs)
      fields.LinkedIn__c = data.linkedin
    }

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
    return NextResponse.json(
      { success: false, error: 'Failed to save enrichment data to Salesforce', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}
