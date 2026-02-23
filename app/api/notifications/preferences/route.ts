import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { getPreferences, updatePreferences } from '@/lib/notifications'
import type { NotificationPreferences } from '@/lib/salesforce-types'

export const dynamic = 'force-dynamic'

// GET /api/notifications/preferences — get user's notification preferences
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

    const prefs = await getPreferences(session.user.email)
    return NextResponse.json({ success: true, data: prefs })
  } catch (error) {
    console.error('Preferences GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

// PUT /api/notifications/preferences — update user's notification preferences
export async function PUT(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    const body = (await req.json()) as Partial<NotificationPreferences>
    const updated = await updatePreferences(session.user.email, body)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Preferences PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
