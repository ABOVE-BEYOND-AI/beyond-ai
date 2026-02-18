import { NextRequest, NextResponse } from 'next/server'
import { getCall } from '@/lib/aircall'
import { analyseCall, type CallAnalysis } from '@/lib/call-analysis'
import { Redis } from '@upstash/redis'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Allow up to 2 minutes for transcription + analysis

// Redis for caching analyses
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY for transcription')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const CACHE_KEY = (callId: number) => `call_analysis:${callId}`
const CACHE_TTL = 60 * 60 * 24 * 7 // 7 days

/**
 * Download an Aircall recording and transcribe it with OpenAI Whisper.
 * Recording URLs expire in 10 minutes, so we fetch fresh from the API.
 */
async function transcribeRecording(recordingUrl: string, agentName: string, contactName: string): Promise<string> {
  // Download the MP3
  const response = await fetch(recordingUrl)
  if (!response.ok) {
    throw new Error(`Failed to download recording: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })

  // Create a File object for the OpenAI API
  const file = new File([blob], 'recording.mp3', { type: 'audio/mpeg' })

  // Transcribe with Whisper
  const openai = getOpenAI()
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'en',
    response_format: 'verbose_json',
    prompt: `Sales call between ${agentName} and ${contactName} at Above and Beyond luxury hospitality company. Events discussed may include Grand Prix, The Open, Wimbledon, Six Nations.`,
  })

  // Format as readable transcript
  // whisper-1 verbose_json includes segments with timestamps
  if ('segments' in transcription && Array.isArray(transcription.segments)) {
    return transcription.segments
      .map((seg: { start: number; text: string }) => {
        const mins = Math.floor(seg.start / 60)
        const secs = Math.floor(seg.start % 60)
        return `[${mins}:${secs.toString().padStart(2, '0')}] ${seg.text.trim()}`
      })
      .join('\n')
  }

  // Fallback to plain text
  return transcription.text
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const callId = body.call_id as number

    if (!callId) {
      return NextResponse.json({ success: false, error: 'call_id is required' }, { status: 400 })
    }

    // Check cache first (gracefully skip if Redis is unavailable)
    const redis = getRedis()
    if (redis) {
      try {
        const cached = await redis.get<CallAnalysis>(CACHE_KEY(callId))
        if (cached) {
          return NextResponse.json({ success: true, data: cached, cached: true })
        }
      } catch (cacheErr) {
        console.warn('Redis cache read failed, proceeding without cache:', cacheErr)
      }
    }

    // Fetch call details (this gives us a fresh recording URL)
    const call = await getCall(callId)

    if (!call.recording) {
      return NextResponse.json(
        { success: false, error: 'No recording available for this call. The recording may have expired or the call was not recorded.' },
        { status: 404 }
      )
    }

    if (call.duration < 60) {
      return NextResponse.json(
        { success: false, error: 'Call too short for meaningful analysis' },
        { status: 400 }
      )
    }

    // Determine contact name
    const contactName = call.contact
      ? [call.contact.first_name, call.contact.last_name].filter(Boolean).join(' ') || 'Contact'
      : 'Contact'
    const agentName = call.user?.name || 'Agent'

    console.log(`🎙️ Transcribing call ${callId} (${call.duration}s) - ${agentName} ↔ ${contactName}`)

    // Step 1: Download recording and transcribe with Whisper
    const transcript = await transcribeRecording(call.recording, agentName, contactName)

    if (transcript.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Transcript too short for meaningful analysis' },
        { status: 400 }
      )
    }

    console.log(`📝 Transcript ready (${transcript.length} chars). Analysing with Claude...`)

    // Step 2: Analyse with Claude
    const analysis = await analyseCall({
      transcript,
      agentName,
      contactName,
      duration: call.duration,
      direction: call.direction,
      callId: call.id,
    })

    console.log(`✅ Analysis complete for call ${callId}`)

    // Cache the result (non-blocking, skip on failure)
    if (redis) {
      redis.set(CACHE_KEY(callId), analysis, { ex: CACHE_TTL }).catch(err =>
        console.warn('Redis cache write failed:', err)
      )
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
