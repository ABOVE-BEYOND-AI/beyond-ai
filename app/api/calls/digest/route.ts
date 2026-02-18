import { NextRequest, NextResponse } from 'next/server'
import {
  getCallsForPeriod,
  getCall,
} from '@/lib/aircall'
import { analyseCall, generateDailyDigest, type CallAnalysis } from '@/lib/call-analysis'
import { Redis } from '@upstash/redis'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes — digest analyses multiple calls

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const ANALYSIS_KEY = (callId: number) => `call_analysis:${callId}`
const DIGEST_KEY = (date: string, period: string) => `daily_digest:${date}:${period}`
const CACHE_TTL = 60 * 60 * 2 // 2 hours

async function transcribeRecording(recordingUrl: string, agentName: string, contactName: string): Promise<string> {
  const response = await fetch(recordingUrl)
  if (!response.ok) throw new Error(`Failed to download recording: ${response.status}`)

  const arrayBuffer = await response.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
  const file = new File([blob], 'recording.mp3', { type: 'audio/mpeg' })

  const openai = getOpenAI()
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'en',
    response_format: 'verbose_json',
    prompt: `Sales call between ${agentName} and ${contactName} at Above and Beyond luxury hospitality company.`,
  })

  if ('segments' in transcription && Array.isArray(transcription.segments)) {
    return transcription.segments
      .map((seg: { start: number; text: string }) => {
        const mins = Math.floor(seg.start / 60)
        const secs = Math.floor(seg.start % 60)
        return `[${mins}:${secs.toString().padStart(2, '0')}] ${seg.text.trim()}`
      })
      .join('\n')
  }
  return transcription.text
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const period = (body.period || 'today') as 'today' | 'week' | 'month'
    const forceRefresh = body.force_refresh === true

    const redis = getRedis()
    const today = new Date().toISOString().split('T')[0]

    // Check digest cache
    if (!forceRefresh && redis) {
      try {
        const cachedDigest = await redis.get(DIGEST_KEY(today, period))
        if (cachedDigest) {
          return NextResponse.json({ success: true, data: cachedDigest, cached: true })
        }
      } catch (cacheErr) {
        console.warn('Redis digest cache read failed:', cacheErr)
      }
    }

    // Fetch all calls for the period
    const calls = await getCallsForPeriod(period)

    // Filter to meaningful calls (2+ minutes, answered)
    const meaningfulCalls = calls.filter(
      c => c.duration >= 120 && (c.status === 'answered' || c.answered_at)
    )

    if (meaningfulCalls.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period: period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month',
          generated_at: new Date().toISOString(),
          total_calls_analysed: 0,
          team_summary: 'No meaningful calls (2+ minutes) recorded in this period yet.',
          top_objections: [],
          winning_pitches: [],
          event_demand: [],
          competitor_intelligence: [],
          follow_up_gaps: [],
          coaching_highlights: [],
          key_deals: [],
        },
        cached: false,
      })
    }

    // Limit to most recent 10 for digest (each needs recording download + Whisper + Claude)
    const callsToAnalyse = meaningfulCalls.slice(0, 10)
    const analyses: CallAnalysis[] = []

    for (const call of callsToAnalyse) {
      try {
        // Check cache
        if (redis) {
          try {
            const cached = await redis.get<CallAnalysis>(ANALYSIS_KEY(call.id))
            if (cached) {
              analyses.push(cached)
              continue
            }
          } catch (cacheErr) {
            // Skip cache
          }
        }

        // Fetch fresh call details (for recording URL)
        const fullCall = await getCall(call.id)
        if (!fullCall.recording) {
          console.warn(`No recording for call ${call.id}, skipping`)
          continue
        }

        const contactName = fullCall.contact
          ? [fullCall.contact.first_name, fullCall.contact.last_name].filter(Boolean).join(' ') || 'Contact'
          : 'Contact'
        const agentName = fullCall.user?.name || 'Agent'

        console.log(`🎙️ Digest: transcribing call ${call.id} (${call.duration}s) - ${agentName}`)

        // Transcribe recording with Whisper
        const transcript = await transcribeRecording(fullCall.recording, agentName, contactName)
        if (transcript.length < 50) continue

        // Analyse with Claude
        const analysis = await analyseCall({
          transcript,
          agentName,
          contactName,
          duration: fullCall.duration,
          direction: fullCall.direction,
          callId: fullCall.id,
        })

        analyses.push(analysis)

        // Cache individual analysis (non-blocking)
        if (redis) {
          redis.set(ANALYSIS_KEY(call.id), analysis, { ex: 60 * 60 * 24 * 7 }).catch(() => {})
        }
      } catch (err) {
        console.error(`Failed to analyse call ${call.id}:`, err)
        // Continue with other calls
      }
    }

    if (analyses.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period: period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month',
          generated_at: new Date().toISOString(),
          total_calls_analysed: 0,
          team_summary: 'Calls were found but no recordings were available for analysis. Recording URLs expire after 10 minutes — try again to fetch fresh URLs.',
          top_objections: [],
          winning_pitches: [],
          event_demand: [],
          competitor_intelligence: [],
          follow_up_gaps: [],
          coaching_highlights: [],
          key_deals: [],
        },
        cached: false,
      })
    }

    // Get unique rep names
    const repNames = [...new Set(analyses.map(a => {
      const matchingCall = callsToAnalyse.find(c => c.id === a.call_id)
      return matchingCall?.user?.name || 'Unknown'
    }).filter(n => n !== 'Unknown'))]

    // Generate the team digest
    const periodLabel = period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'
    const digest = await generateDailyDigest({
      analyses,
      repNames,
      period: periodLabel,
    })

    // Cache the digest (non-blocking)
    if (redis) {
      redis.set(DIGEST_KEY(today, period), digest, { ex: CACHE_TTL }).catch(() => {})
    }

    return NextResponse.json({ success: true, data: digest, cached: false })
  } catch (error) {
    console.error('Error generating digest:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate digest' },
      { status: 500 }
    )
  }
}
