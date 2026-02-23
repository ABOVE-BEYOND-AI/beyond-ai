import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import {
  startSequence,
  getActiveSequences,
  getOutreachStats,
} from '@/lib/email-sequences'

export const dynamic = 'force-dynamic'

/**
 * GET /api/email/sequences
 * List active/paused sequences for the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    const repEmail = session.user.email

    const [sequences, stats] = await Promise.all([
      getActiveSequences(repEmail),
      getOutreachStats(repEmail),
    ])

    return NextResponse.json({
      success: true,
      data: {
        sequences,
        stats: {
          activeCount: sequences.filter(s => s.status === 'active').length,
          pausedCount: sequences.filter(s => s.status === 'paused').length,
          emailsSent: stats.emailsSent,
        },
      },
    })
  } catch (error) {
    console.error('Sequences GET error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sequences',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/sequences
 * Start a new email sequence.
 * Body: { templateId, contactId, contactEmail, contactName, steps: { day, subject, body }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { templateId, contactId, contactEmail, contactName, steps } = body as {
      templateId?: string
      contactId?: string
      contactEmail?: string
      contactName?: string
      steps?: { day: number; subject: string; body: string }[]
    }

    if (!templateId || !contactEmail || !contactName || !steps || steps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: templateId, contactEmail, contactName, steps',
        },
        { status: 400 }
      )
    }

    const sequence = await startSequence({
      templateId,
      contactId: contactId || '',
      contactEmail,
      contactName,
      repEmail: session.user.email,
      repName: session.user.name,
      steps,
    })

    return NextResponse.json(
      { success: true, data: sequence },
      { status: 201 }
    )
  } catch (error) {
    console.error('Sequences POST error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start sequence',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}
