import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createConversation, getConversations } from '@/lib/chat-persistence'

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
 * GET /api/chat/conversations
 * List the authenticated user's conversations (most recent first).
 * Query params: ?limit=50
 */
export async function GET(req: Request) {
  const email = await getAuthEmail()
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
    200
  )

  try {
    const conversations = await getConversations(email, limit)
    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Failed to list conversations:', error)
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/chat/conversations
 * Create a new conversation.
 * Body: { title?: string }
 */
export async function POST(req: Request) {
  const email = await getAuthEmail()
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title : undefined

    const id = await createConversation(email, title)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}
