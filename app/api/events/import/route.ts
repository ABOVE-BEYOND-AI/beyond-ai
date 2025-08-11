import { NextRequest, NextResponse } from 'next/server'
import { saveEvent } from '@/lib/events-database'

type IncomingEvent = {
  name: string
  startDate: string
  endDate: string
  location?: string
  description?: string
  category?: string
}

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await req.json()
    const items: IncomingEvent[] = Array.isArray(payload) ? payload : payload?.items
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Expected an array of events or { items: Event[] }' }, { status: 400 })
    }

    let created = 0
    for (const e of items) {
      if (!e?.name || !e?.startDate || !e?.endDate) continue
      await saveEvent({
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        location: e.location || '',
        description: e.description || '',
        category: (e.category || '').toLowerCase().replace(/\s+/g, '-')
      })
      created++
    }

    return NextResponse.json({ success: true, created })
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to import events' }, { status: 500 })
  }
}


