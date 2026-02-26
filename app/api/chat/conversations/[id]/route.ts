import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getConversation,
  updateConversationTitle,
  deleteConversation,
} from '@/lib/chat-persistence'

/**
 * Decode the beyond_ai_session cookie and return the user's email, or null.
 */
async function getAuthEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('beyond_ai_session')
    if (!session?.value) return null

    const decoded = JSON.parse(
      Buffer.from(decodeURIComponent(session.value), 'base64').toString()
    )
    return decoded?.user?.email ?? null
  } catch {
    return null
  }
}

/**
 * GET /api/chat/conversations/[id]
 * Get a conversation with all its messages.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getAuthEmail()
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const data = await getConversation(id)
    if (!data) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Ensure the requesting user owns this conversation
    if (data.meta.userEmail !== email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to get conversation:', error)
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/chat/conversations/[id]
 * Update conversation title.
 * Body: { title: string }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getAuthEmail()
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Verify ownership
    const data = await getConversation(id)
    if (!data) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }
    if (data.meta.userEmail !== email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    await updateConversationTitle(id, body.title.trim())
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update conversation:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/chat/conversations/[id]
 * Delete a conversation and all its data.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getAuthEmail()
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Verify ownership before deleting
    const data = await getConversation(id)
    if (!data) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }
    if (data.meta.userEmail !== email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await deleteConversation(email, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete conversation:', error)
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
