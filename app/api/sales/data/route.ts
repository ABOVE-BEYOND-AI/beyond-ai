import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getDashboardData, type SalesPeriod } from '@/lib/salesforce'
import { verifySecureSession } from '@/lib/session-security'

export const dynamic = 'force-dynamic'

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Path 1: authenticated session (dashboard pages)
  const sessionCookie = request.cookies.get('beyond_ai_session')?.value
  if (sessionCookie) {
    const session = await verifySecureSession(sessionCookie)
    if (session?.email) return true
  }

  // Path 2: TV access key (kiosk display)
  const tvKey = process.env.TV_ACCESS_KEY
  if (tvKey) {
    const providedKey = request.nextUrl.searchParams.get('key')
    if (providedKey && constantTimeEquals(providedKey, tvKey)) return true
  }

  return false
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'month') as SalesPeriod

    if (!['today', 'week', 'month', 'year'].includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
    }

    const data = await getDashboardData(period)

    return NextResponse.json({
      success: true,
      data,
    }, {
      headers: {
        // Short cache — stale-while-revalidate lets the UI feel instant
        // while background refresh gets fresh data
        'Cache-Control': 'private, s-maxage=15, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    console.error('Sales Data API error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch sales data',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 },
    )
  }
}
