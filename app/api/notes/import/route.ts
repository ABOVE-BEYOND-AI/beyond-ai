import { NextRequest, NextResponse } from 'next/server'
import { importNotesFromCSV } from '@/lib/notes-import'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Allow up to 2 minutes for large imports

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
    const contentType = request.headers.get('content-type') || ''

    let csvContent: string

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        )
      }
      csvContent = await file.text()
    } else {
      // Handle raw CSV in body
      const body = await request.json()
      csvContent = body.csv
      if (!csvContent) {
        return NextResponse.json(
          { success: false, error: 'No CSV content provided' },
          { status: 400 }
        )
      }
    }

    if (csvContent.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty' },
        { status: 400 }
      )
    }

    console.log(`📥 Starting FreshSales notes import (${csvContent.length} chars)`)
    const result = await importNotesFromCSV(csvContent)
    console.log(`✅ Import complete: ${result.successCount} created, ${result.failedCount} failed, ${result.skippedCount} skipped`)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Notes import error:', error)
    return apiErrorResponse(error, 'Import failed')
  }
}
