import { NextRequest, NextResponse } from 'next/server'
import { getRepGapDetail } from '@/lib/call-gaps'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calls/gaps/detail?user_id=12345&date=2026-03-27
 *
 * Returns individual gaps for a specific rep on a given date.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const date = searchParams.get('date')

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const parsedId = parseInt(userId, 10)
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: 'user_id must be a number' }, { status: 400 })
    }

    // Default to today if no date specified
    const targetDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })

    const { gaps, summary } = await getRepGapDetail(parsedId, targetDate)

    return NextResponse.json({
      success: true,
      data: {
        user_id: parsedId,
        date: targetDate,
        gaps,
        summary,
        gap_count: gaps.length,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching gap detail:', error)
    return apiErrorResponse(error, 'Failed to fetch gap detail')
  }
}
