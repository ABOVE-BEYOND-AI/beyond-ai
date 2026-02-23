import { NextRequest, NextResponse } from 'next/server'
import { searchTranscripts, getRecentTranscripts, getStoredTranscriptCount } from '@/lib/transcript-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword') || searchParams.get('q') || searchParams.get('search')
    const fromDate = searchParams.get('fromDate') || searchParams.get('from') || undefined
    const toDate = searchParams.get('toDate') || searchParams.get('to') || undefined
    const agentName = searchParams.get('agent') || undefined
    const direction = searchParams.get('direction') as 'inbound' | 'outbound' | undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50

    const totalStored = await getStoredTranscriptCount()

    if (keyword && keyword.trim().length > 0) {
      // Search mode
      const results = await searchTranscripts(keyword.trim(), {
        fromDate,
        toDate,
        agentName,
        direction,
        limit,
      })

      return NextResponse.json(
        {
          success: true,
          data: { results, totalStored, query: keyword, resultCount: results.length },
        },
        { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
      )
    } else {
      // Recent transcripts mode
      const recent = await getRecentTranscripts(limit)

      return NextResponse.json(
        {
          success: true,
          data: {
            results: recent.map(t => ({
              callId: t.callId,
              agentName: t.agentName,
              contactName: t.contactName,
              duration: t.duration,
              direction: t.direction,
              startedAt: t.startedAt,
              wordCount: t.wordCount,
              createdAt: t.createdAt,
            })),
            totalStored,
          },
        },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
      )
    }
  } catch (error) {
    console.error('Transcript search error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search transcripts', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}
