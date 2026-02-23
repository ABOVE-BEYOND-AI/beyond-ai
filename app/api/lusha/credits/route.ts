import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { getLushaKey, checkCredits } from '@/lib/lusha'

export const dynamic = 'force-dynamic'

/**
 * GET /api/lusha/credits — Check remaining Lusha credits for the current user
 * Returns: { success: true, data: { credits: number, connected: boolean } }
 */
export async function GET(request: NextRequest) {
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

    // Get user's stored Lusha API key
    const apiKey = await getLushaKey(email)
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        data: { credits: 0, connected: false },
      })
    }

    const result = await checkCredits(apiKey)

    return NextResponse.json({
      success: true,
      data: { credits: result.credits, connected: true },
    })
  } catch (error) {
    console.error('Lusha credits error:', error)

    // If credits check fails due to auth, report as disconnected
    const message = error instanceof Error ? error.message : ''
    if (message.includes('401') || message.includes('403')) {
      return NextResponse.json({
        success: true,
        data: { credits: 0, connected: false },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Failed to check Lusha credits', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}
