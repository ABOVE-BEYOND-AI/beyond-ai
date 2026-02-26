import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getConversation,
  appendMessages,
  type ChatMessage,
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
 * Validate that an object looks like a ChatMessage.
 */
function isValidMessage(msg: unknown): msg is ChatMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as Record<string, unknown>
  return (
    typeof m.id === 'string' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string' &&
    typeof m.createdAt === 'string'
  )
}

/**
 * POST /api/chat/conversations/[id]/messages
 * Append messages to a conversation.
 * Body: { messages: ChatMessage[] }
 */
export async function POST(
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
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'messages must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate each message
    for (const msg of body.messages) {
      if (!isValidMessage(msg)) {
        return NextResponse.json(
          {
            error:
              'Each message must have id (string), role ("user" | "assistant"), content (string), and createdAt (string)',
          },
          { status: 400 }
        )
      }
    }

    await appendMessages(id, body.messages)
    return NextResponse.json({ success: true, appended: body.messages.length })
  } catch (error) {
    console.error('Failed to append messages:', error)
    return NextResponse.json(
      { error: 'Failed to append messages' },
      { status: 500 }
    )
  }
}
