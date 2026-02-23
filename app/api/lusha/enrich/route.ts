import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { getLushaKey, enrichPerson } from '@/lib/lusha'

export const dynamic = 'force-dynamic'

/**
 * POST /api/lusha/enrich — Enrich a person using the current user's stored Lusha API key
 * Body: { firstName: string, lastName: string, company?: string }
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

    const email = session.user.email

    // Get user's stored Lusha API key
    const apiKey = await getLushaKey(email)
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Lusha not connected. Please add your Lusha API key in settings.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, company } = body as {
      firstName?: string
      lastName?: string
      company?: string
    }

    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'firstName is required' },
        { status: 400 }
      )
    }

    if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'lastName is required' },
        { status: 400 }
      )
    }

    const result = await enrichPerson(apiKey, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company?.trim(),
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Lusha enrich error:', error)

    // Surface Lusha API errors more clearly
    const message = error instanceof Error ? error.message : 'Failed to enrich person'
    const status = message.includes('401') || message.includes('403') ? 401 : 500

    return NextResponse.json(
      { success: false, error: message, details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status }
    )
  }
}
