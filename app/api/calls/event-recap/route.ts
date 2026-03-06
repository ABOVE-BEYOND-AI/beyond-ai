import { NextRequest, NextResponse } from 'next/server'
import { generateEventRecap } from '@/lib/event-recap'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calls/event-recap
 * Returns today's event recap (cached or freshly generated).
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const recap = await generateEventRecap(false)

    return NextResponse.json(
      { success: true, data: recap },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    console.error('Error generating event recap:', error)
    return apiErrorResponse(error, 'Failed to generate event recap')
  }
}

/**
 * POST /api/calls/event-recap
 * Accepts { force_refresh: true } to bypass cache and regenerate.
 */
export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
    const body = await request.json()
    const forceRefresh = body.force_refresh === true

    const recap = await generateEventRecap(forceRefresh)

    return NextResponse.json(
      { success: true, data: recap, refreshed: forceRefresh },
      {
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache' : 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    console.error('Error generating event recap:', error)
    return apiErrorResponse(error, 'Failed to generate event recap')
  }
}
