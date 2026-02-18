import { NextRequest, NextResponse } from 'next/server'
import { getCall, getTranscription, formatTranscriptForAI } from '@/lib/aircall'
import { analyseCall, type CallAnalysis } from '@/lib/call-analysis'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

// Redis for caching analyses
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const CACHE_KEY = (callId: number) => `call_analysis:${callId}`
const CACHE_TTL = 60 * 60 * 24 * 7 // 7 days

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const callId = body.call_id as number

    if (!callId) {
      return NextResponse.json({ success: false, error: 'call_id is required' }, { status: 400 })
    }

    // Check cache first
    const redis = getRedis()
    if (redis) {
      const cached = await redis.get<CallAnalysis>(CACHE_KEY(callId))
      if (cached) {
        return NextResponse.json({ success: true, data: cached, cached: true })
      }
    }

    // Fetch call details and transcript
    const [call, transcription] = await Promise.all([
      getCall(callId),
      getTranscription(callId),
    ])

    if (!transcription || !transcription.content?.utterances?.length) {
      return NextResponse.json(
        { success: false, error: 'No transcript available for this call' },
        { status: 404 }
      )
    }

    // Format transcript for AI
    const transcriptText = formatTranscriptForAI(transcription, call)

    if (transcriptText.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Transcript too short for meaningful analysis' },
        { status: 400 }
      )
    }

    // Run AI analysis
    const contactName = call.contact
      ? [call.contact.first_name, call.contact.last_name].filter(Boolean).join(' ') || 'Contact'
      : 'Contact'

    const analysis = await analyseCall({
      transcript: transcriptText,
      agentName: call.user?.name || 'Agent',
      contactName,
      duration: call.duration,
      direction: call.direction,
      callId: call.id,
    })

    // Cache the result
    if (redis) {
      await redis.set(CACHE_KEY(callId), analysis, { ex: CACHE_TTL })
    }

    return NextResponse.json({ success: true, data: analysis, cached: false })
  } catch (error) {
    console.error('Error analysing call:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to analyse call' },
      { status: 500 }
    )
  }
}
