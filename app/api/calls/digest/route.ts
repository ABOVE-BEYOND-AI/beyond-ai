import { NextRequest, NextResponse } from 'next/server'
import {
  getCallsForPeriod,
  getTranscription,
  formatTranscriptForAI,
  getCall,
} from '@/lib/aircall'
import { analyseCall, generateDailyDigest, type CallAnalysis } from '@/lib/call-analysis'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const ANALYSIS_KEY = (callId: number) => `call_analysis:${callId}`
const DIGEST_KEY = (date: string, period: string) => `daily_digest:${date}:${period}`
const CACHE_TTL = 60 * 60 * 2 // 2 hours for digest cache

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const period = (body.period || 'today') as 'today' | 'week' | 'month'
    const forceRefresh = body.force_refresh === true

    const redis = getRedis()
    const today = new Date().toISOString().split('T')[0]

    // Check digest cache (unless force refresh)
    if (!forceRefresh && redis) {
      const cachedDigest = await redis.get(DIGEST_KEY(today, period))
      if (cachedDigest) {
        return NextResponse.json({ success: true, data: cachedDigest, cached: true })
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

    // Analyse calls — check cache first, then analyse remaining
    // Limit to most recent 20 meaningful calls to manage API costs
    const callsToAnalyse = meaningfulCalls.slice(0, 20)
    const analyses: CallAnalysis[] = []

    for (const call of callsToAnalyse) {
      try {
        // Check cache
        if (redis) {
          const cached = await redis.get<CallAnalysis>(ANALYSIS_KEY(call.id))
          if (cached) {
            analyses.push(cached)
            continue
          }
        }

        // Fetch full call details and transcript
        const [fullCall, transcription] = await Promise.all([
          getCall(call.id),
          getTranscription(call.id),
        ])

        if (!transcription?.content?.utterances?.length) continue

        const transcriptText = formatTranscriptForAI(transcription, fullCall)
        if (transcriptText.length < 50) continue

        const contactName = fullCall.contact
          ? [fullCall.contact.first_name, fullCall.contact.last_name].filter(Boolean).join(' ') || 'Contact'
          : 'Contact'

        const analysis = await analyseCall({
          transcript: transcriptText,
          agentName: fullCall.user?.name || 'Agent',
          contactName,
          duration: fullCall.duration,
          direction: fullCall.direction,
          callId: fullCall.id,
        })

        analyses.push(analysis)

        // Cache individual analysis
        if (redis) {
          await redis.set(ANALYSIS_KEY(call.id), analysis, { ex: 60 * 60 * 24 * 7 })
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
          team_summary: 'Calls were found but none had transcripts available for analysis.',
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

    // Cache the digest
    if (redis) {
      await redis.set(DIGEST_KEY(today, period), digest, { ex: CACHE_TTL })
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
