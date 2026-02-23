import { NextRequest, NextResponse } from 'next/server'
import { createOutboundCall } from '@/lib/aircall'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phoneNumber } = body

    if (!userId || !phoneNumber) {
      return NextResponse.json(
        { error: 'Missing userId or phoneNumber' },
        { status: 400 }
      )
    }

    const call = await createOutboundCall(userId, phoneNumber)

    return NextResponse.json({ success: true, data: call })
  } catch (error) {
    console.error('Dialer call API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to initiate call',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}
