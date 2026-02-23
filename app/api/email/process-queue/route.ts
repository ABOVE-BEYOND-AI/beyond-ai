import { NextResponse } from 'next/server'
import { processQueue } from '@/lib/email-sequences'

export const dynamic = 'force-dynamic'

/**
 * POST /api/email/process-queue
 *
 * Cron endpoint that processes all due scheduled emails.
 * Designed to be called every 1-5 minutes by a cron service (e.g., Vercel Cron).
 *
 * Optionally protected by a shared secret in the CRON_SECRET env var.
 * If CRON_SECRET is set, the request must include an Authorization header
 * with `Bearer <CRON_SECRET>`.
 */
export async function POST(request: Request) {
  try {
    // Optional: verify cron secret if set
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
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
