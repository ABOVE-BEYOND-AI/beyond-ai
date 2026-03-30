import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getCachedCallsForPeriod } from '@/lib/aircall'
import { buildCallDashboardData } from '@/lib/call-dashboard'
import { computeGapsFromCalls, computeTeamAvgGap } from '@/lib/call-gaps'
import {
  saveSnapshot,
  getSnapshotDay,
  listSnapshotDates,
  getSnapshot,
  type SnapshotSlot,
  type SnapshotType,
} from '@/lib/snapshot-store'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/**
 * POST /api/calls/snapshot
 *
 * Vercel Cron endpoint — captures daily snapshots of Overview, Dial Pace, and AI Digest.
 * Runs at 1pm (midday) and 6pm (eod) UK time on weekdays.
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: CRON_SECRET (Vercel Cron) or authenticated user (manual trigger)
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const isCronRequest = !!cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isCronRequest) {
      // Fall back to user auth for manual triggers
      await requireApiUser(request)
    }

    const now = new Date()
    const date = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    const ukHour = parseInt(now.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }))
    const slot: SnapshotSlot = ukHour < 15 ? 'midday' : 'eod'

    // 1. Fetch today's calls (uses shared cache — no extra Aircall API calls)
    const calls = await getCachedCallsForPeriod('today')

    // 2. Build overview snapshot
    const overview = buildCallDashboardData('today', calls)

    // 3. Build dial pace snapshot
    const reps = computeGapsFromCalls(calls)
    const teamAvg = computeTeamAvgGap(reps)
    // Strip individual gaps array to save space — keep only summary per rep
    const dialPace = {
      reps: reps.map(({ gaps, ...rest }) => rest),
      team_avg_gap_seconds: teamAvg.avg_gap_seconds,
      team_total_reps: teamAvg.total_reps,
      team_total_gaps: teamAvg.total_gaps,
    }

    // 4. Read cached AI digest if available (don't generate — that's expensive)
    let digest = null
    const redis = getRedis()
    if (redis) {
      try {
        digest = await redis.get(`daily_digest:${date}:today`)
      } catch {}
    }

    // 5. Save all snapshots
    await Promise.all([
      saveSnapshot(date, slot, 'overview', overview),
      saveSnapshot(date, slot, 'dial_pace', dialPace),
      ...(digest ? [saveSnapshot(date, slot, 'digest', digest)] : []),
    ])

    return NextResponse.json({
      success: true,
      date,
      slot,
      saved: {
        overview: true,
        dial_pace: true,
        digest: !!digest,
      },
      calls_count: calls.length,
      reps_count: reps.length,
    })
  } catch (error) {
    console.error('Snapshot error:', error)
    return NextResponse.json({ error: 'Snapshot failed' }, { status: 500 })
  }
}

/**
 * GET /api/calls/snapshot
 *
 * Retrieve historical snapshots.
 * Query params:
 *   ?dates              — list all available snapshot dates
 *   ?date=YYYY-MM-DD    — return all snapshots for that date
 *   ?date=YYYY-MM-DD&slot=eod&type=overview — return a specific snapshot
 *   ?limit=30&offset=0  — pagination for dates list
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)

    const { searchParams } = new URL(request.url)

    // List available dates
    if (searchParams.has('dates')) {
      const limit = parseInt(searchParams.get('limit') || '30', 10)
      const offset = parseInt(searchParams.get('offset') || '0', 10)
      const { dates, total } = await listSnapshotDates(limit, offset)
      return NextResponse.json({ success: true, data: { dates, total } })
    }

    const date = searchParams.get('date')
    if (!date) {
      return NextResponse.json({ error: 'Provide ?dates to list or ?date=YYYY-MM-DD to retrieve' }, { status: 400 })
    }

    // Specific snapshot
    const slot = searchParams.get('slot') as SnapshotSlot | null
    const type = searchParams.get('type') as SnapshotType | null

    if (slot && type) {
      const data = await getSnapshot(date, slot, type)
      return NextResponse.json({ success: true, data: { date, slot, type, snapshot: data } })
    }

    // Full day
    const day = await getSnapshotDay(date)
    return NextResponse.json({ success: true, data: { date, ...day } })
  } catch (error) {
    console.error('Snapshot retrieval error:', error)
    return apiErrorResponse(error, 'Failed to retrieve snapshot')
  }
}
