import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { recordCallEnded, recordCallStarted } from '@/lib/call-gaps'

export const dynamic = 'force-dynamic'

// Recently processed call IDs — prevents duplicate processing on webhook retries
const recentCallIds = new Map<string, number>() // key: "event:callId", value: timestamp
const DEDUP_WINDOW_MS = 300_000 // 5 minutes

function isDuplicate(event: string, callId: number): boolean {
  const key = `${event}:${callId}`
  const now = Date.now()

  // Clean old entries
  for (const [k, ts] of recentCallIds) {
    if (now - ts > DEDUP_WINDOW_MS) recentCallIds.delete(k)
  }

  if (recentCallIds.has(key)) return true
  recentCallIds.set(key, now)
  return false
}

/**
 * POST /api/webhooks/aircall
 *
 * Handles Aircall webhook events for gap tracking:
 * - call.created → records call start, calculates gap from previous call
 * - call.ended → records call end timestamp for future gap calculation
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook token (fail-closed — reject if not configured)
    const expectedToken = process.env.AIRCALL_WEBHOOK_TOKEN
    if (!expectedToken) {
      console.error('❌ AIRCALL_WEBHOOK_TOKEN not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    const body = await request.json()

    // Runtime payload validation
    if (
      !body ||
      typeof body.event !== 'string' ||
      typeof body.token !== 'string' ||
      typeof body.data !== 'object' ||
      body.data === null
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Timing-safe token comparison
    try {
      const expected = Buffer.from(expectedToken)
      const received = Buffer.from(body.token)
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        console.warn('⚠️ Aircall webhook: invalid token')
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { event, data } = body

    // Validate required data fields
    if (typeof data.id !== 'number' || typeof data.direction !== 'string') {
      return NextResponse.json({ error: 'Invalid call data' }, { status: 400 })
    }

    // Skip if no user associated (IVR, voicemail, etc.)
    if (!data.user || typeof data.user.id !== 'number') {
      return NextResponse.json({ ok: true, skipped: 'no_user' })
    }

    // Idempotency — skip duplicate webhook deliveries
    if (isDuplicate(event, data.id)) {
      return NextResponse.json({ ok: true, skipped: 'duplicate' })
    }

    const userId = data.user.id
    const repName = (data.user.name || 'Unknown').slice(0, 100) // Truncate to prevent abuse

    switch (event) {
      case 'call.created': {
        const startedAt = typeof data.started_at === 'number' ? data.started_at : Math.floor(Date.now() / 1000)

        const gap = await recordCallStarted(
          userId,
          repName,
          data.id,
          startedAt,
          data.direction as 'inbound' | 'outbound'
        )

        console.log(
          `📞 call.created: ${repName} (${data.direction})` +
          (gap ? ` — gap: ${gap.gap_seconds}s` : ' — no previous call')
        )

        return NextResponse.json({
          ok: true,
          event: 'call.created',
          gap_seconds: gap?.gap_seconds ?? null,
        })
      }

      case 'call.ended': {
        const endedAt = typeof data.ended_at === 'number' ? data.ended_at : Math.floor(Date.now() / 1000)
        const duration = typeof data.duration === 'number' ? data.duration : 0

        await recordCallEnded(
          userId,
          repName,
          data.id,
          endedAt,
          data.direction as 'inbound' | 'outbound',
          duration
        )

        console.log(
          `📞 call.ended: ${repName} (${data.direction}, ${duration}s)`
        )

        return NextResponse.json({
          ok: true,
          event: 'call.ended',
        })
      }

      default: {
        // Ignore other events (call.answered, call.hungup, etc.)
        return NextResponse.json({ ok: true, skipped: event })
      }
    }
  } catch (error) {
    console.error('❌ Aircall webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Aircall sends a GET to verify the endpoint on setup
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
