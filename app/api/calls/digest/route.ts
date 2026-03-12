import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getCallDashboardData, type CallPeriod, type CallListItem } from '@/lib/call-dashboard'
import { generateEventRecap } from '@/lib/event-recap'
import { getRecentTranscripts, storeTranscript } from '@/lib/transcript-store'
import { type CallAnalysis } from '@/lib/call-analysis'
import { getCall } from '@/lib/aircall'
import { transcribeFromUrl } from '@/lib/deepgram'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface DigestPayload {
  period: string
  generated_at: string
  total_calls_analysed: number
  team_summary: string
  top_objections: {
    objection: string
    frequency: number
    suggested_response: string
  }[]
  winning_pitches: {
    description: string
    rep: string
    context: string
  }[]
  event_demand: {
    event: string
    mentions: number
    sentiment: string
  }[]
  competitor_intelligence: {
    competitor: string
    mentions: number
    context: string
  }[]
  follow_up_gaps: {
    rep: string
    description: string
  }[]
  coaching_highlights: {
    rep: string
    type: 'strength' | 'improvement'
    description: string
  }[]
  key_deals: {
    contact: string
    rep: string
    status: string
    next_steps: string
  }[]
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function periodLabel(period: CallPeriod): string {
  if (period === 'today') return 'Today'
  if (period === 'week') return 'This Week'
  return 'This Month'
}

function periodStartTimestamp(period: CallPeriod): number {
  const now = new Date()
  if (period === 'today') {
    return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000)
  }
  if (period === 'week') {
    const day = now.getDay()
    return Math.floor(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((day + 6) % 7)).getTime() / 1000
    )
  }
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000)
}

const DIGEST_KEY = (date: string, period: CallPeriod) => `daily_digest:${date}:${period}`
const ANALYSIS_KEY = (callId: number) => `call_analysis:${callId}`
const CACHE_TTL = 60 * 15

/**
 * Fetch cached individual call analyses from Redis.
 */
async function getCachedAnalyses(callIds: number[], redis: Redis): Promise<CallAnalysis[]> {
  if (callIds.length === 0) return []

  const analyses: CallAnalysis[] = []
  for (let i = 0; i < callIds.length; i += 20) {
    const batch = callIds.slice(i, i + 20)
    const results = await Promise.allSettled(
      batch.map(id => redis.get<CallAnalysis>(ANALYSIS_KEY(id)))
    )
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        analyses.push(result.value)
      }
    }
  }

  return analyses
}

// ── Zod schema for structured AI output ──

const digestSchema = z.object({
  team_summary: z.string().describe('3-5 sentence executive summary. Cover: total call volume, answer rate, meaningful conversations, top performers, deal momentum, key themes, energy/pace. Be specific with numbers and names.'),
  top_objections: z.array(z.object({
    objection: z.string().describe('The specific objection pattern heard across calls'),
    frequency: z.number().describe('How many times this objection came up'),
    suggested_response: z.string().describe('1-2 punchy sentences MAX — displayed on a sales floor screen, not a manual'),
  })).describe('Common objections heard across calls. Return empty array if insufficient data.'),
  winning_pitches: z.array(z.object({
    description: z.string().describe('What the rep said or did that worked'),
    rep: z.string().describe('Rep name'),
    context: z.string().describe('Brief context — event, client type, situation'),
  })).describe('Effective sales techniques observed. Return empty array if insufficient data.'),
  event_demand: z.array(z.object({
    event: z.string().describe('Event name'),
    mentions: z.number().describe('How many times this event was mentioned in calls'),
    sentiment: z.string().describe('HOT/WARM/MIXED/CAUTION/CRITICAL — then a brief note explaining why'),
  })).describe('Event-level demand signals from calls, deals, and upcoming targets.'),
  competitor_intelligence: z.array(z.object({
    competitor: z.string().describe('Competitor name'),
    mentions: z.number().describe('Number of mentions across calls'),
    context: z.string().describe('What was said about them — pricing, availability, quality'),
  })).describe('Competitor mentions from calls. Return empty array if none.'),
  coaching_highlights: z.array(z.object({
    rep: z.string().describe('Rep name'),
    type: z.enum(['strength', 'improvement']),
    description: z.string().describe('Specific observation with numbers — answer rates, call durations, outbound balance'),
  })).describe('Per-rep coaching observations. Analyse EVERY rep — strong answer rates, long meaningful calls, areas to improve.'),
  follow_up_gaps: z.array(z.object({
    rep: z.string().describe('Rep name'),
    description: z.string().describe('Specific gap — e.g. heavy outbound but low answer rate, short call durations'),
  })).describe('Reps who may be missing follow-up opportunities.'),
  key_deals: z.array(z.object({
    contact: z.string().describe('Deal/opportunity name'),
    rep: z.string().describe('Rep who closed it'),
    status: z.string().describe('e.g. "Closed today for £1,605"'),
    next_steps: z.string().describe('Specific actionable next step for this deal — fulfilment, upsell opportunity, or follow-up needed'),
  })).describe('Deals closed in this period. Include specific next steps based on the event and deal context.'),
})

const MAX_RETRIES = 2

/**
 * Generate AI-powered digest insights using Gemini 2.5 Flash with structured output.
 * Uses generateObject for guaranteed valid JSON — no parsing failures.
 * Retries up to MAX_RETRIES times on failure.
 */
async function generateAIDigestInsights(input: {
  transcripts: { callId: number; agent: string; contact: string; direction: string; duration: number; transcript: string }[]
  analyses: CallAnalysis[]
  repStats: { name: string; total_calls: number; answered_calls: number; outbound_calls: number; inbound_calls: number; avg_duration: number; longest_call: number }[]
  meaningfulCalls: CallListItem[]
  totalCalls: number
  answeredCalls: number
  dealsToday: { name: string; amount: number; owner: string; event: string }[]
  upcomingEvents: { name: string; category: string | null; percentageToTarget: number | null }[]
  period: string
}): Promise<Partial<DigestPayload>> {
  const sections: string[] = []

  // Section 1: Rep stats (always available)
  sections.push(`TEAM REP STATS (${input.repStats.length} reps):
${input.repStats.map(r => {
  const answerRate = r.total_calls > 0 ? Math.round((r.answered_calls / r.total_calls) * 100) : 0
  const outboundPct = r.total_calls > 0 ? Math.round((r.outbound_calls / r.total_calls) * 100) : 0
  return `- ${r.name}: ${r.total_calls} calls (${answerRate}% answered, ${outboundPct}% outbound), avg ${Math.round(r.avg_duration / 60)}min, longest ${Math.round(r.longest_call / 60)}min`
}).join('\n')}`)

  // Section 2: Call activity overview
  const answerRate = input.totalCalls > 0 ? Math.round((input.answeredCalls / input.totalCalls) * 100) : 0
  sections.push(`CALL ACTIVITY:
- Total calls: ${input.totalCalls} (${input.answeredCalls} answered, ${answerRate}% answer rate)
- Meaningful calls (3+ min): ${input.meaningfulCalls.length}
- Meaningful call breakdown: ${input.meaningfulCalls.map(c => `${c.agent_name} <> ${c.contact_name} (${c.direction}, ${Math.round(c.duration / 60)}min)`).slice(0, 20).join('; ')}`)

  // Section 3: Deals (if any)
  if (input.dealsToday.length > 0) {
    sections.push(`DEALS CLOSED ${input.period.toUpperCase()}:
${input.dealsToday.map(d => `- ${d.name}: £${Math.round(d.amount).toLocaleString()} by ${d.owner} for ${d.event}`).join('\n')}
Total deal value: £${Math.round(input.dealsToday.reduce((s, d) => s + d.amount, 0)).toLocaleString()}`)
  }

  // Section 4: Upcoming events with targets
  if (input.upcomingEvents.length > 0) {
    sections.push(`UPCOMING EVENTS (use target %s to flag which need attention):
${input.upcomingEvents.slice(0, 15).map(e => {
  const target = e.percentageToTarget !== null ? ` — ${Math.round(e.percentageToTarget)}% to target` : ''
  return `- ${e.name}${e.category ? ` [${e.category}]` : ''}${target}`
}).join('\n')}`)
  }

  // Section 5: Cached analyses (high quality, already processed by Claude)
  // Prioritise these — they're pre-distilled and token-efficient
  if (input.analyses.length > 0) {
    const analysisSummaries = input.analyses.map(a =>
      `[Analysed Call] Sentiment: ${a.sentiment} (${a.sentiment_score}/100)\n` +
      `Summary: ${a.summary}\n` +
      `Objections: ${a.objections.length > 0 ? a.objections.join('; ') : 'None'}\n` +
      `Events: ${a.events_mentioned.length > 0 ? a.events_mentioned.map(e => typeof e === 'string' ? e : `${e.event} (${e.context})`).join(', ') : 'None'}\n` +
      `Competitors: ${a.competitor_mentions.length > 0 ? a.competitor_mentions.join(', ') : 'None'}\n` +
      `Opportunities: ${a.opportunity_signals.map(o => `${o.type}: ${o.description}`).join('; ') || 'None'}\n` +
      `Coaching: ${a.coaching_notes || 'None'}`
    )
    sections.push(`AI-ANALYSED CALL DETAILS (${input.analyses.length} calls):\n\n${analysisSummaries.join('\n\n---\n\n')}`)
  }

  // Section 6: Raw transcripts — only for calls without analysis, budget-capped
  const analysedCallIds = new Set(input.analyses.map(a => a.call_id))
  const unanalysedTranscripts = input.transcripts.filter(t => !analysedCallIds.has(t.callId))
  if (unanalysedTranscripts.length > 0) {
    // Dynamic word limit: fewer words per transcript when there are many, to stay within budget
    const maxTranscripts = Math.min(unanalysedTranscripts.length, 15)
    const wordsPerTranscript = maxTranscripts > 8 ? 250 : 400
    const transcriptSummaries = unanalysedTranscripts.slice(0, maxTranscripts).map(t => {
      const words = t.transcript.split(/\s+/)
      const truncated = words.length > wordsPerTranscript ? words.slice(0, wordsPerTranscript).join(' ') + '...' : t.transcript
      return `[Transcript] ${t.agent} <> ${t.contact} (${t.direction}, ${Math.round(t.duration / 60)}min)\n${truncated}`
    })
    sections.push(`RAW TRANSCRIPTS (${unanalysedTranscripts.length} calls, showing ${maxTranscripts}):\n\n${transcriptSummaries.join('\n\n---\n\n')}`)
  }

  const hasDeepData = input.analyses.length > 0 || input.transcripts.length > 0

  const model = google('gemini-3.1-pro-preview')

  const prompt = `You are the AI sales intelligence engine for Above + Beyond, a luxury hospitality company selling premium event packages (Formula 1, The Open, Wimbledon, Six Nations, Cheltenham, Ryder Cup, etc.).

You're generating the ${input.period} team digest — this is shown to the WHOLE COMPANY on a sales floor screen at lunch and end of day. Make it sharp, specific, and energising.

DATA:
${sections.join('\n\n')}

INSTRUCTIONS:
- team_summary: 3-5 sentences. Lead with energy. Cover call volume, answer rate, meaningful conversations, name top performers, deal momentum.${hasDeepData ? ' Weave in key themes from conversations.' : ''}
- top_objections: Pull specific objection patterns from calls. Suggested responses must be 1-2 punchy sentences — this is a sales floor screen, not a training manual.
- winning_pitches: What specific techniques/phrases/approaches worked? Name the rep and context.
- event_demand: Cross-reference call mentions, closed deals, and upcoming event target %s. Flag events that are HOT (high demand, deals closing), need CAUTION (behind target), or CRITICAL (way behind).
- competitor_intelligence: Who are clients comparing you to? What are they saying about pricing, availability, quality?
- coaching_highlights: Analyse EVERY rep individually. Reference their specific numbers — answer rate, call count, avg duration. Identify both strengths and areas for improvement.
- follow_up_gaps: Reps with heavy outbound but low answer rates, short call durations suggesting shallow conversations, or missed opportunities.
- key_deals: For each deal closed, include specific next steps — what needs to happen for fulfilment? Any upsell opportunity? Client follow-up needed?${!hasDeepData ? '\n- Without transcript/analysis data, focus coaching on call PATTERNS: answer rates, outbound/inbound balance, call durations, volume distribution.' : ''}
- Every insight should tell the team what to DO next
- Keep it punchy, not corporate — this is for hungry salespeople
- Return empty arrays ONLY for categories with genuinely zero relevant data`

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await generateObject({
        model,
        prompt,
        schema: digestSchema,
        maxOutputTokens: 16384,
        providerOptions: {
          google: {
            thinkingConfig: { thinkingBudget: 4096 },
          },
        },
      })

      return result.object
    } catch (err) {
      console.error(`AI digest generation failed (attempt ${attempt}/${MAX_RETRIES}):`, err)
      if (attempt === MAX_RETRIES) return {}
    }
  }

  return {}
}

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request)
    const body = await request.json()
    const period = (body.period || 'today') as CallPeriod
    const forceRefresh = body.force_refresh === true

    const redis = getRedis()
    const today = new Date().toISOString().split('T')[0]

    if (!forceRefresh && redis) {
      try {
        const cachedDigest = await redis.get<DigestPayload>(DIGEST_KEY(today, period))
        if (cachedDigest) {
          return NextResponse.json({ success: true, data: cachedDigest, cached: true })
        }
      } catch (error) {
        console.warn('Redis digest cache read failed:', error)
      }
    }

    // Fetch all data sources in parallel
    const [{ data: callData }, recap, recentTranscripts] = await Promise.all([
      getCallDashboardData(period),
      generateEventRecap(false),
      getRecentTranscripts(100),
    ])

    const startTimestamp = periodStartTimestamp(period)
    const transcriptsInPeriod = recentTranscripts.filter(t => t.startedAt >= startTimestamp)

    // Fetch cached analyses for meaningful calls
    const meaningfulCallIds = callData.analysableCalls.map(c => c.id)
    let cachedAnalyses: CallAnalysis[] = []
    if (redis && meaningfulCallIds.length > 0) {
      cachedAnalyses = await getCachedAnalyses(meaningfulCallIds, redis)
    }

    const transcriptData = transcriptsInPeriod.map(t => ({
      callId: t.callId,
      agent: t.agentName,
      contact: t.contactName,
      direction: t.direction,
      duration: t.duration,
      transcript: t.transcript,
    }))

    // Identify meaningful calls that have neither cached analysis nor stored transcript
    const analysedCallIds = new Set(cachedAnalyses.map(a => a.call_id))
    const storedTranscriptIds = new Set(transcriptsInPeriod.map(t => t.callId))
    const callsNeedingTranscription = callData.analysableCalls.filter(
      c => !analysedCallIds.has(c.id) && !storedTranscriptIds.has(c.id) && c.has_recording
    )

    // Batch transcribe up to 10 calls with Deepgram (in parallel)
    if (callsNeedingTranscription.length > 0) {
      const batchSize = Math.min(callsNeedingTranscription.length, 10)
      const batch = callsNeedingTranscription.slice(0, batchSize)
      console.log(`Digest: batch transcribing ${batchSize} calls with Deepgram...`)

      const transcriptionResults = await Promise.allSettled(
        batch.map(async (c) => {
          try {
            const call = await getCall(c.id)
            const recordingUrl = call.recording || call.asset
            if (!recordingUrl) return null

            const contactName = call.contact
              ? [call.contact.first_name, call.contact.last_name].filter(Boolean).join(' ') || 'Contact'
              : 'Contact'
            const agentName = call.user?.name || 'Agent'

            const result = await transcribeFromUrl(recordingUrl, agentName, contactName, call.direction)

            // Store in Redis for future use (non-blocking)
            storeTranscript(c.id, {
              agentName,
              contactName,
              duration: call.duration,
              direction: call.direction,
              startedAt: call.started_at,
            }, result.transcript).catch(err => console.warn(`Failed to store transcript for ${c.id}:`, err))

            return {
              callId: c.id,
              agent: agentName,
              contact: contactName,
              direction: call.direction,
              duration: call.duration,
              transcript: result.transcript,
            }
          } catch (err) {
            console.warn(`Failed to transcribe call ${c.id} for digest:`, (err as Error).message)
            return null
          }
        })
      )

      let newTranscripts = 0
      for (const result of transcriptionResults) {
        if (result.status === 'fulfilled' && result.value) {
          transcriptData.push(result.value)
          newTranscripts++
        }
      }
      console.log(`Digest: batch transcription complete — ${newTranscripts}/${batchSize} succeeded`)
    }

    console.log(`Digest: ${cachedAnalyses.length} cached analyses, ${transcriptData.length} transcripts, ${callData.analysableCalls.length} meaningful calls, ${callData.stats.total_calls} total calls`)

    // Always generate AI insights — works with stats even without transcripts
    const aiInsights = await generateAIDigestInsights({
      transcripts: transcriptData,
      analyses: cachedAnalyses,
      repStats: callData.repStats.map(r => ({
        name: r.name,
        total_calls: r.total_calls,
        answered_calls: r.answered_calls,
        outbound_calls: r.outbound_calls,
        inbound_calls: r.inbound_calls,
        avg_duration: r.avg_duration,
        longest_call: r.longest_call,
      })),
      meaningfulCalls: callData.analysableCalls,
      totalCalls: callData.stats.total_calls,
      answeredCalls: callData.stats.answered_calls,
      dealsToday: recap.dealsClosedToday.map(d => ({
        name: d.name,
        amount: d.amount,
        owner: d.owner,
        event: d.event,
      })),
      upcomingEvents: recap.upcomingEvents.map(e => ({
        name: e.name,
        category: e.category,
        percentageToTarget: e.percentageToTarget,
      })),
      period: periodLabel(period),
    })

    // AI generates key_deals with intelligent next_steps; fall back to basic recap data
    const fallbackDeals: DigestPayload['key_deals'] = recap.dealsClosedToday.slice(0, 8).map(d => ({
      contact: d.name,
      rep: d.owner,
      status: `Closed today for £${Math.round(d.amount).toLocaleString()}`,
      next_steps: `Confirm fulfilment handoff for ${d.event}.`,
    }))

    const digest: DigestPayload = {
      period: periodLabel(period),
      generated_at: new Date().toISOString(),
      total_calls_analysed: callData.meaningfulCallCount,
      team_summary: aiInsights.team_summary || `${periodLabel(period)} logged ${callData.stats.total_calls} calls with ${callData.stats.answered_calls} answered and ${callData.meaningfulCallCount} meaningful conversations.`,
      top_objections: aiInsights.top_objections || [],
      winning_pitches: aiInsights.winning_pitches || [],
      event_demand: aiInsights.event_demand || [],
      competitor_intelligence: aiInsights.competitor_intelligence || [],
      follow_up_gaps: aiInsights.follow_up_gaps || [],
      coaching_highlights: aiInsights.coaching_highlights || [],
      key_deals: (aiInsights.key_deals && aiInsights.key_deals.length > 0) ? aiInsights.key_deals : fallbackDeals,
    }

    if (redis) {
      redis.set(DIGEST_KEY(today, period), digest, { ex: CACHE_TTL }).catch((error) => {
        console.warn('Redis digest cache write failed:', error)
      })
    }

    return NextResponse.json({ success: true, data: digest, cached: false })
  } catch (error) {
    console.error('Error generating digest:', error)
    return apiErrorResponse(error, 'Failed to generate digest')
  }
}
