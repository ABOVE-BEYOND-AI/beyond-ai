import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import {
  getSequence,
  pauseSequence,
  resumeSequence,
  cancelSequence,
  deleteSequence,
} from '@/lib/email-sequences'

export const dynamic = 'force-dynamic'

/**
 * GET /api/email/sequences/[id]
 * Get a single sequence by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const sequence = await getSequence(id)

    if (!sequence) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      )
    }

    // Ensure the user owns this sequence
    if (sequence.repEmail !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: sequence })
  } catch (error) {
    console.error('Sequence GET error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sequence',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/email/sequences/[id]
 * Update sequence status: pause, resume, or cancel.
 * Body: { action: 'pause' | 'resume' | 'cancel' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const existing = await getSequence(id)

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      )
    }

    if (existing.repEmail !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body as { action?: string }

    let updated
    switch (action) {
      case 'pause':
        updated = await pauseSequence(id)
        break
      case 'resume':
        updated = await resumeSequence(id)
        break
      case 'cancel':
        updated = await cancelSequence(id)
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: pause, resume, or cancel' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Sequence PATCH error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update sequence',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email/sequences/[id]
 * Cancel and delete a sequence permanently.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const existing = await getSequence(id)

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 }
      )
    }

    if (existing.repEmail !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    await deleteSequence(id)

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    console.error('Sequence DELETE error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete sequence',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}
