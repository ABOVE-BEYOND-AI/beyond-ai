import { NextRequest, NextResponse } from 'next/server'
import { getTranscript } from '@/lib/transcript-store'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params
    const numericId = Number(callId)

    if (isNaN(numericId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid call ID' },
        { status: 400 }
      )
    }

    const transcript = await getTranscript(numericId)

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcript not found. This call may not have been transcribed yet.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: true, data: transcript },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (error) {
    console.error('Get transcript error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transcript' },
      { status: 500 }
    )
  }
}
