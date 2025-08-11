import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getDeals, deleteDealById } from '@/lib/sales-database'

// *** SAFETY ***
// This route nukes ALL keys that start with "sales:".  It is protected by a
// shared secret header so it cannot be called accidentally.
// ----------------------------------------------------------------
//  Call with:
//  curl -X POST https://<domain>/api/sales/admin/purge \
//       -H "x-admin-secret: YOUR_SECRET"
// ----------------------------------------------------------------

const redis = Redis.fromEnv()

export async function POST(req: NextRequest) {
  const adminSecretHeader = req.headers.get('x-admin-secret')
  const adminSecretEnv = process.env.ADMIN_SECRET

  if (!adminSecretEnv || adminSecretHeader !== adminSecretEnv) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { scope, month } = Object.fromEntries(req.nextUrl.searchParams) as { scope?: string; month?: string }

    if (scope === 'manual-august') {
      // Delete only deals created in the given month and sourced as manual
      const targetMonth = month || '2025-08'
      const all = await getDeals(5000, 0)
      const candidates = all.filter(d => d.source === 'manual' && d.created_at.startsWith(targetMonth))

      let deleted = 0
      for (const d of candidates) {
        const ok = await deleteDealById(d.id)
        if (ok) deleted++
      }

      return NextResponse.json({ success: true, scope, month: targetMonth, deleted })
    }

    // Default behavior: nuke everything (safeguarded)
    const keys: string[] = await redis.keys('sales:*')
    if (keys.length === 0) {
      return NextResponse.json({ message: 'No sales keys found to delete.' })
    }
    await Promise.all(keys.map((k) => redis.del(k)))
    return NextResponse.json({ success: true, deleted: keys.length })
  } catch (err) {
    console.error('❌ Purge error', err)
    return NextResponse.json({ error: 'Failed to purge' }, { status: 500 })
  }
}
