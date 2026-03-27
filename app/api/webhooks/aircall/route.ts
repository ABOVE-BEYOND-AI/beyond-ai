import { NextRequest, NextResponse } from 'next/server'
import { recordCallEnded, recordCallStarted } from '@/lib/call-gaps'

export const dynamic = 'force-dynamic'

// Aircall webhook payload types
interface AircallWebhookPayload {
  event: string
  token: string
  timestamp: number
  data: {
    id: number
    direction: 'inbound' | 'outbound'
    status: string
    started_at: number
    answered_at: number | null
    ended_at: number | null
    duration: number
    raw_digits: string
    user: {
      id: number
      name: string
      email: string
    } | null
    contact: {
      id: number
      first_name: string | null
      last_name: string | null
    } | null
    number: {
      id: number
      name: string
      digits: string
    } | null
  }
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
    const body = await request.json() as AircallWebhookPayload

    // Validate webhook token
    const expectedToken = process.env.AIRCALL_WEBHOOK_TOKEN
    if (expectedToken && body.token !== expectedToken) {
      console.warn('⚠️ Aircall webhook: invalid token')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { event, data } = body

    // Skip if no user associated (IVR, voicemail, etc.)
    if (!data.user) {
      return NextResponse.json({ ok: true, skipped: 'no_user' })
    }

    const userId = data.user.id
    const repName = data.user.name

    switch (event) {
      case 'call.created': {
        const gap = await recordCallStarted(
          userId,
          repName,
          data.id,
          data.started_at,
          data.direction
        )

        console.log(
          `📞 call.created: ${repName} (${data.direction})` +
          (gap ? ` — gap: ${gap.gap_seconds}s` : ' — no previous call')
        )

        return NextResponse.json({
          ok: true,
          event: 'call.created',
          gap_seconds: gap?.gap_seconds || null,
        })
      }

      case 'call.ended': {
        const endedAt = data.ended_at || Math.floor(Date.now() / 1000)

        await recordCallEnded(
          userId,
          repName,
          data.id,
          endedAt,
          data.direction,
          data.duration || 0
        )

        console.log(
          `📞 call.ended: ${repName} (${data.direction}, ${data.duration}s)`
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
  return NextResponse.json({ status: 'ok', service: 'aircall-webhook' })
}
