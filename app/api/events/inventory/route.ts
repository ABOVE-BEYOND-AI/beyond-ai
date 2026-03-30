import { NextResponse } from 'next/server'
import { getEventsWithInventory } from '@/lib/salesforce'
import { resolveEventImage } from '@/lib/event-images'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

let redis: Redis | null = null
function getRedis() {
  if (!redis) redis = Redis.fromEnv()
  return redis
}

export async function GET() {
  try {
    const events = await getEventsWithInventory()

    // Attach cached Serper images to events that need them
    const needsImage = events.filter(
      (e) => !e.Event_Image_1__c && !resolveEventImage(e.Name),
    )

    if (needsImage.length > 0) {
      try {
        const r = getRedis()
        const keys = needsImage.map((e) => `serper:img:${e.Name.toLowerCase().trim()}`)
        const cached = await r.mget<(string | null)[]>(...keys)

        for (let i = 0; i < needsImage.length; i++) {
          const url = cached[i]
          if (url) {
            // Attach as a virtual field — not in Salesforce, just for the frontend
            ;(needsImage[i] as Record<string, unknown>).Serper_Image__c = url
          }
        }
      } catch {
        // Redis error — serve events without Serper images
      }
    }

    return NextResponse.json({ success: true, data: events }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Events inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events inventory', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
