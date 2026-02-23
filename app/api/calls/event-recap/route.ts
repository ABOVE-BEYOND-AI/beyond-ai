import { NextRequest, NextResponse } from 'next/server'
import { generateEventRecap } from '@/lib/event-recap'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calls/event-recap
 * Returns today's event recap (cached or freshly generated).
 */
export async function GET() {
  try {
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate event recap',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calls/event-recap
 * Accepts { force_refresh: true } to bypass cache and regenerate.
 */
export async function POST(request: NextRequest) {
  try {
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate event recap',
      },
      { status: 500 }
    )
  }
}
