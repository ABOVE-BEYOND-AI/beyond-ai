import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
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
    const ctx = await requireApiUser(request)
    const repEmail = ctx.email

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
    return apiErrorResponse(error, 'Failed to fetch sequences')
  }
}

/**
 * POST /api/email/sequences
 * Start a new email sequence.
 * Body: { templateId, contactId, contactEmail, contactName, steps: { day, subject, body }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireApiUser(request)

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
      repEmail: ctx.email,
      repName: ctx.user.name,
      steps,
    })

    return NextResponse.json(
      { success: true, data: sequence },
      { status: 201 }
    )
  } catch (error) {
    console.error('Sequences POST error:', error)
    return apiErrorResponse(error, 'Failed to start sequence')
  }
}
