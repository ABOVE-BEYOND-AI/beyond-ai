import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getConversation, exportConversation } from '@/lib/chat-persistence'

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
 * GET /api/chat/conversations/[id]/export
 * Export a conversation as Markdown text.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getAuthEmail()
  if (!email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
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

    const markdown = await exportConversation(id)

    // Sanitize the title for use in a filename
    const safeTitle = data.meta.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60)

    return new Response(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeTitle || 'conversation'}.md"`,
      },
    })
  } catch (error) {
    console.error('Failed to export conversation:', error)
    return NextResponse.json(
      { error: 'Failed to export conversation' },
      { status: 500 }
    )
  }
}
