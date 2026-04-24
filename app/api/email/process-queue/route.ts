import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { processQueue } from '@/lib/email-sequences'

export const dynamic = 'force-dynamic'

function verifyCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get('Authorization') || ''
  const expected = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * POST /api/email/process-queue
 *
 * Cron endpoint that processes all due scheduled emails. Requires
 * `Authorization: Bearer $CRON_SECRET`. Fail-closed: if CRON_SECRET is unset
 * the route refuses every request, including from Vercel Cron.
 */
export async function POST(request: Request) {
  try {
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const result = await processQueue()

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Process queue error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process queue',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}
