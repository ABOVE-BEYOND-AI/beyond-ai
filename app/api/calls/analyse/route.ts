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
    prompt: `This is a British sales call between ${agentName} (sales rep at Above and Beyond, a luxury hospitality company) and ${contactName} (client/prospect). They discuss premium event hospitality packages for sporting events like Formula 1 Grand Prix, The Open Championship, Wimbledon, Six Nations rugby, Cheltenham, and the Ryder Cup. British English accents.`,
  })

  // Format as readable transcript with timestamps
  if ('segments' in transcription && Array.isArray(transcription.segments)) {
    return transcription.segments
      .map((seg: { start: number; text: string }) => {
        const mins = Math.floor(seg.start / 60)
        const secs = Math.floor(seg.start % 60)
        return `[${mins}:${secs.toString().padStart(2, '0')}] ${seg.text.trim()}`
      })
      .filter(line => {
        // Filter out empty or near-empty segments
        const textPart = line.replace(/^\[\d+:\d+\]\s*/, '')
        return textPart.length > 2
      })
      .join('\n')
  }

  return transcription.text
}

/**
 * Validate that a transcript has enough meaningful content for analysis.
 * Filters out transcripts that are mostly silence markers, hold music, or noise.
 */
function isTranscriptMeaningful(transcript: string): { valid: boolean; reason?: string } {
  // Count actual words (strip timestamps)
  const textOnly = transcript.replace(/\[\d+:\d+\]/g, '').trim()
  const words = textOnly.split(/\s+/).filter(w => w.length > 1)

  if (words.length < 30) {
    return { valid: false, reason: `Transcript only contains ${words.length} words — likely silence, hold music, or voicemail. Need at least 30 words of conversation.` }
  }

  // Check for repeated patterns (Whisper sometimes hallucinates repetitive content)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()))
  const uniqueRatio = uniqueWords.size / words.length
  if (uniqueRatio < 0.15 && words.length > 50) {
    return { valid: false, reason: 'Transcript appears to be repetitive noise or hallucinated content.' }
  }

  return { valid: true }
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

    if (call.duration < 90) {
      return NextResponse.json(
        { success: false, error: 'Call too short for meaningful analysis (need 90+ seconds)' },
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

    // Step 2: Validate transcript quality
    const validation = isTranscriptMeaningful(transcript)
    if (!validation.valid) {
      console.warn(`⚠️ Call ${callId} transcript rejected: ${validation.reason}`)
      return NextResponse.json(
        { success: false, error: validation.reason },
        { status: 400 }
      )
    }

    console.log(`📝 Transcript ready (${transcript.length} chars). Analysing with Claude...`)

    // Step 3: Analyse with Claude
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
