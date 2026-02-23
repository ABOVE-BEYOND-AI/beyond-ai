import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import {
  getAllNotifications,
  getUnreadNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// GET /api/notifications — list notifications for current user
export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    const email = session.user.email
    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const notifications = unreadOnly
      ? await getUnreadNotifications(email, limit)
      : await getAllNotifications(email, limit)

    const unreadCount = await getUnreadCount(email)

    return NextResponse.json({
      success: true,
      data: { notifications, unreadCount },
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// POST /api/notifications — mark notification(s) as read
export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    const email = session.user.email
    const body = await req.json()
    const { notificationId, markAll: markAllFlag } = body as {
      notificationId?: string
      markAll?: boolean
    }

    if (markAllFlag) {
      await markAllRead(email)
    } else if (notificationId) {
      await markRead(email, notificationId)
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide notificationId or markAll: true' },
        { status: 400 }
      )
    }

    const unreadCount = await getUnreadCount(email)

    return NextResponse.json({ success: true, data: { unreadCount } })
  } catch (error) {
    console.error('Notifications POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
