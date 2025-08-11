import { NextResponse } from 'next/server'
import { getEvent, updateEvent, deleteEvent } from '@/lib/events-database'

function getIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname
  const parts = pathname.split('/')
  return parts[parts.length - 1]
}

export async function GET(req: Request) {
  const id = getIdFromUrl(req.url)
  const item = await getEvent(id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(req: Request) {
  const adminSecret = req.headers.get('x-admin-secret')
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const id = getIdFromUrl(req.url)
  const updated = await updateEvent(id, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request) {
  const adminSecret = req.headers.get('x-admin-secret')
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = getIdFromUrl(req.url)
  const ok = await deleteEvent(id)
  return NextResponse.json({ success: ok })
}


