import { NextResponse } from 'next/server'
import { getEvent, updateEvent, deleteEvent } from '@/lib/events-database'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const item = await getEvent(params.id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const adminSecret = req.headers.get('x-admin-secret')
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const updated = await updateEvent(params.id, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const adminSecret = req.headers.get('x-admin-secret')
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ok = await deleteEvent(params.id)
  return NextResponse.json({ success: ok })
}


