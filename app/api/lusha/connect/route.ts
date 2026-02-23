import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { storeLushaKey, getLushaKey, deleteLushaKey } from '@/lib/lusha'

export const dynamic = 'force-dynamic'

/**
 * POST /api/lusha/connect — Save user's personal Lusha API key
 * Body: { apiKey: string }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('beyond_ai_session')?.value
    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const session = decodeSession(sessionCookie)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    const body = await request.json()
    const { apiKey } = body as { apiKey?: string }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    const email = session.user.email
    await storeLushaKey(email, apiKey.trim())

    return NextResponse.json({
      success: true,
      data: { connected: true, email },
    })
  } catch (error) {
    console.error('Lusha connect error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save Lusha API key', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/lusha/connect — Disconnect (remove stored Lusha API key)
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('beyond_ai_session')?.value
    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const session = decodeSession(sessionCookie)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    const email = session.user.email

    // Check if key exists before deleting
    const existingKey = await getLushaKey(email)
    if (!existingKey) {
      return NextResponse.json(
        { success: false, error: 'No Lusha API key found for this user' },
        { status: 404 }
      )
    }

    await deleteLushaKey(email)

    return NextResponse.json({
      success: true,
      data: { connected: false, email },
    })
  } catch (error) {
    console.error('Lusha disconnect error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove Lusha API key', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}
