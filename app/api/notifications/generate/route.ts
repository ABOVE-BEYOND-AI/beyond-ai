import { NextRequest, NextResponse } from 'next/server'
import { runAllGenerators } from '@/lib/notification-generators'
import { getAllUsers } from '@/lib/redis-database'

export const dynamic = 'force-dynamic'

// POST /api/notifications/generate — run notification generators
// Body: { email: string } to run for one user, or empty to run for all users
export async function POST(req: NextRequest) {
  try {
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
    const results: Array<{ email: string; staleDeals: number; overduePayments: number; newLeads: number }> = []

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
    return NextResponse.json(
      { success: false, error: 'Failed to generate notifications' },
      { status: 500 }
    )
  }
}
