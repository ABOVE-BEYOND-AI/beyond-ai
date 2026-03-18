import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getPreferences, updatePreferences } from '@/lib/notifications'
import type { NotificationPreferences } from '@/lib/salesforce-types'

export const dynamic = 'force-dynamic'

// GET /api/notifications/preferences — get user's notification preferences
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireApiUser(req)
    const prefs = await getPreferences(ctx.email)
    return NextResponse.json({ success: true, data: prefs })
  } catch (error) {
    console.error('Preferences GET error:', error)
    return apiErrorResponse(error, 'Failed to fetch preferences')
  }
}

// PUT /api/notifications/preferences — update user's notification preferences
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireApiUser(req)
    const body = (await req.json()) as Partial<NotificationPreferences>
    const updated = await updatePreferences(ctx.email, body)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Preferences PUT error:', error)
    return apiErrorResponse(error, 'Failed to update preferences')
  }
}
