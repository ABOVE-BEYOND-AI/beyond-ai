import { NextRequest, NextResponse } from 'next/server'
import { addTagToCall, addCommentToCall } from '@/lib/aircall'
import { createNote, updateRecord } from '@/lib/salesforce'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
    const body = await request.json()
    const { callId, objectType, recordId, disposition, notes, tagName } = body

    if (!objectType || !recordId || !disposition) {
      return NextResponse.json(
        { error: 'Missing required fields: objectType, recordId, disposition' },
        { status: 400 }
      )
    }

    // Run Aircall operations in parallel if applicable
    const aircallOps: Promise<void>[] = []

    if (callId && tagName) {
      aircallOps.push(addTagToCall(callId, tagName))
    }

    if (callId && notes) {
      aircallOps.push(addCommentToCall(callId, notes))
    }

    // Update the Salesforce record's Recent_Note__c with the disposition + notes
    const timestamp = new Date().toISOString().split('T')[0]
    const noteContent = notes
      ? `[${timestamp}] ${disposition}: ${notes}`
      : `[${timestamp}] ${disposition}`

    const sfOps: Promise<unknown>[] = [updateRecord(objectType, recordId, {
      Recent_Note__c: noteContent,
    })]

    // Preserve a searchable note history for Contacts instead of overwriting the latest note only.
    if (objectType === 'Contact') {
      sfOps.push(createNote(recordId, noteContent))
    }

    // Wait for all operations to complete
    await Promise.all([...aircallOps, ...sfOps])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Dialer disposition API error:', error)
    return apiErrorResponse(error, 'Failed to log disposition')
  }
}
