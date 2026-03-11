import { NextRequest, NextResponse } from 'next/server'
import { getCall, getTranscription, formatTranscriptForAI } from '@/lib/aircall'
import { analyseCall, type CallAnalysis } from '@/lib/call-analysis'
import { storeTranscript, getTranscript } from '@/lib/transcript-store'
import { transcribeFromUrl } from '@/lib/deepgram'
import { Redis } from '@upstash/redis'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Allow up to 2 minutes for transcription + analysis

// Redis for caching analyses
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const CACHE_KEY = (callId: number) => `call_analysis:${callId}`
const CACHE_TTL = 60 * 60 * 24 * 7 // 7 days

/**
 * Validate that a transcript has enough meaningful content for analysis.
 * Filters out transcripts that are mostly silence markers, hold music, or noise.
 */
function isTranscriptMeaningful(transcript: string): { valid: boolean; reason?: string } {
  // Count actual words (strip timestamps and speaker labels)
  const textOnly = transcript.replace(/\[\d+:\d+\]/g, '').replace(/^[A-Za-z\s]+:/gm, '').trim()
  const words = textOnly.split(/\s+/).filter(w => w.length > 1)

  if (words.length < 20) {
    return { valid: false, reason: `Transcript only contains ${words.length} words — likely silence, hold music, or voicemail. Need at least 20 words of conversation.` }
  }

  // Check for repeated patterns (transcription sometimes hallucinates repetitive content)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()))
  const uniqueRatio = uniqueWords.size / words.length
  if (uniqueRatio < 0.15 && words.length > 50) {
    return { valid: false, reason: 'Transcript appears to be repetitive noise or hallucinated content.' }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
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
          const storedTranscript = await getTranscript(callId)
          return NextResponse.json({ success: true, data: cached, transcript: storedTranscript?.transcript || null, cached: true })
        }
      } catch (cacheErr) {
        console.warn('Redis cache read failed, proceeding without cache:', cacheErr)
      }
    }

    // Fetch call details (this gives us a fresh recording URL)
    const call = await getCall(callId)

    if (!call.recording && !call.asset) {
      return NextResponse.json(
        { success: false, error: 'No recording available for this call. The recording may have expired or the call was not recorded.' },
        { status: 404 }
      )
    }

    if (call.duration < 60) {
      return NextResponse.json(
        { success: false, error: 'Call too short for meaningful analysis (need 60+ seconds)' },
        { status: 400 }
      )
    }

    // Determine contact name
    const contactName = call.contact
      ? [call.contact.first_name, call.contact.last_name].filter(Boolean).join(' ') || 'Contact'
      : 'Contact'
    const agentName = call.user?.name || 'Agent'

    console.log(`Transcribing call ${callId} (${call.duration}s) - ${agentName} <> ${contactName}`)

    // Step 1: Try Aircall's native transcription first (free), fall back to Deepgram Nova-3
    let transcript: string | null = null

    try {
      const aircallTranscript = await getTranscription(callId)
      if (aircallTranscript?.content?.utterances?.length) {
        transcript = formatTranscriptForAI(aircallTranscript, call)
        console.log(`Got Aircall transcription for call ${callId} (${transcript.length} chars)`)
      }
    } catch {
      console.log(`Aircall transcription not available for ${callId}, trying Deepgram...`)
    }

    if (!transcript && (call.recording || call.asset)) {
      const recordingUrl = call.recording || call.asset!
      const result = await transcribeFromUrl(recordingUrl, agentName, contactName, call.direction)
      transcript = result.transcript
      console.log(`Deepgram transcript ready for call ${callId} (${transcript.length} chars, ${result.speakerCount} speakers)`)
    }

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Could not transcribe call — no Aircall transcription available and recording may have expired.' },
        { status: 400 }
      )
    }

    // Step 2: Validate transcript quality
    const validation = isTranscriptMeaningful(transcript)
    if (!validation.valid) {
      console.warn(`Call ${callId} transcript rejected: ${validation.reason}`)
      return NextResponse.json(
        { success: false, error: validation.reason },
        { status: 400 }
      )
    }

    // Store transcript for search (non-blocking)
    storeTranscript(callId, {
      agentName,
      contactName,
      duration: call.duration,
      direction: call.direction,
      startedAt: call.started_at,
    }, transcript).catch(err => console.warn('Failed to store transcript:', err))

    // Step 3: Analyse with Claude
    console.log(`Analysing call ${callId} with Claude...`)
    const analysis = await analyseCall({
      transcript,
      agentName,
      contactName,
      duration: call.duration,
      direction: call.direction,
      callId: call.id,
    })

    console.log(`Analysis complete for call ${callId}`)

    // Cache the result (non-blocking, skip on failure)
    if (redis) {
      redis.set(CACHE_KEY(callId), analysis, { ex: CACHE_TTL }).catch(err =>
        console.warn('Redis cache write failed:', err)
      )
    }

    return NextResponse.json({ success: true, data: analysis, transcript, cached: false })
  } catch (error) {
    console.error('Error analysing call:', error)
    return apiErrorResponse(error, 'Failed to analyse call')
  }
}
