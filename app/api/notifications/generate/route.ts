import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runAllGenerators } from '@/lib/notification-generators'
import { getAllUsers } from '@/lib/redis-database'
import { apiErrorResponse, requireApiAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

function isCronAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = req.headers.get('authorization') || ''
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

// POST /api/notifications/generate — run notification generators.
// Auth: either CRON_SECRET (Vercel Cron / scheduled trigger) OR an admin session.
// Body: { email: string } to run for one user, or empty to run for all users.
export async function POST(req: NextRequest) {
  try {
    if (!isCronAuth(req)) {
      await requireApiAdmin(req)
    }

    const body = await req.json().catch(() => ({})) as { email?: string }

    if (body.email) {
      // Run for a single user
      const results = await runAllGenerators(body.email)
      return NextResponse.json({
        success: true,
        data: { email: body.email, ...results },
      })
    }

    // Run for all users
    const users = await getAllUsers()
    const results: Array<{ email: string; staleDeals: number; overduePayments: number; newLeads: number; dailyRecap: number }> = []

    for (const user of users) {
      const result = await runAllGenerators(user.email)
      results.push({ email: user.email, ...result })
    }

    return NextResponse.json({
      success: true,
      data: { usersProcessed: results.length, results },
    })
  } catch (error) {
    console.error('Generate notifications error:', error)
    return apiErrorResponse(error, 'Failed to generate notifications')
  }
}
