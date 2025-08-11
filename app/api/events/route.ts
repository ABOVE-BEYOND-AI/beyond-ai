import { NextRequest, NextResponse } from 'next/server'
import { listEvents, saveEvent } from '@/lib/events-database'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') || undefined
  const category = searchParams.get('category') || undefined
  const q = searchParams.get('q') || undefined
  const limit = Number(searchParams.get('limit') || '50')
  const offset = Number(searchParams.get('offset') || '0')
  const items = await listEvents({ month, category, q, limit, offset })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret')
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const { name, startDate, endDate, location, description, category } = body
    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const id = await saveEvent({ name, startDate, endDate, location: location || '', description: description || '', category: (category || '').toLowerCase().replace(/\s+/g, '-') })
    return NextResponse.json({ success: true, id })
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}


