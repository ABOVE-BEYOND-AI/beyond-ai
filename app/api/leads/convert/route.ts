import { NextRequest, NextResponse } from 'next/server'
import { convertLead } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId } = body

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    const result = await convertLead(leadId)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Lead conversion error:', error)
    return NextResponse.json(
      { error: 'Failed to convert lead', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
