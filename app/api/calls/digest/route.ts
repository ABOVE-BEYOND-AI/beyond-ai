import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getCallDashboardData, type CallPeriod, type CallListItem, type CallDashboardData } from '@/lib/call-dashboard'
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

/**
 * Try to fetch yesterday's call stats from Redis for comparison context.
 */
async function getYesterdayStats(redis: Redis | null): Promise<{ total_calls: number; answered_calls: number; meaningful: number } | null> {
  if (!redis) return null
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().slice(0, 10)
    // Check both fresh and stale cache keys
    const cached = await redis.get<CallDashboardData>(`calls_data:today:${dateStr}`)
      || await redis.get<CallDashboardData>(`calls_data_stale:today:${dateStr}`)
    if (!cached) return null
    return {
      total_calls: cached.stats.total_calls,
      answered_calls: cached.stats.answered_calls,
      meaningful: cached.meaningfulCallCount,
    }
  } catch {
    return null
  }
}

// ── Zod schema for structured AI output ──

const digestSchema = z.object({
  team_summary: z.string().describe('3-5 sentence executive summary for the whole company. Lead with energy. Cover: call volume (with vs-yesterday comparison if provided), answer rate, meaningful conversations, top performers by name, deal momentum, and key conversation themes. Be specific — use exact numbers and rep names.'),
  top_objections: z.array(z.object({
    objection: z.string().describe('The specific objection pattern heard across calls'),
    frequency: z.number().describe('How many times this objection came up across the data'),
    suggested_response: z.string().describe('1-2 punchy sentences MAX — displayed on a sales floor screen, not a manual. Must be something a rep could say verbatim.'),
  })).describe('Common objections heard across calls. Return empty array if insufficient transcript/analysis data.'),
  winning_pitches: z.array(z.object({
    description: z.string().describe('What the rep said or did that worked — be specific about the technique'),
    rep: z.string().describe('Rep name'),
    context: z.string().describe('Brief context — event, client type, what made it work'),
  })).describe('Effective sales techniques observed in transcripts/analyses. Return empty array if no conversation data.'),
  event_demand: z.array(z.object({
    event: z.string().describe('Event name — use exact name from the data'),
    mentions: z.number().describe('How many times this event was mentioned across calls, deals, and analyses'),
    sentiment: z.string().describe('Start with a keyword: HOT / WARM / MIXED / CAUTION / CRITICAL — then " — " then a brief reason. Example: "HOT — 4 calls today, deal closing, 85% to target". Use revenue numbers and target gaps when available.'),
  })).describe('Event-level demand signals. Cross-reference call mentions, deal data, and revenue targets. Every upcoming event should appear — even with 0 mentions if it has target data, flag it. Sort by urgency.'),
  competitor_intelligence: z.array(z.object({
    competitor: z.string().describe('Competitor name'),
    mentions: z.number().describe('Number of mentions across calls'),
    context: z.string().describe('What was said — pricing comparisons, availability, quality. Be specific.'),
  })).describe('Competitor mentions from calls/analyses. Return empty array if genuinely none.'),
  coaching_highlights: z.array(z.object({
    rep: z.string().describe('Rep name'),
    type: z.enum(['strength', 'improvement']),
    description: z.string().describe('Specific observation with exact numbers from the data. Reference answer rate, talk-to-listen ratio, call duration patterns, action item follow-through.'),
  })).describe('Per-rep coaching. Analyse EVERY rep who made calls. Use their specific stats (answer rate, outbound %, avg duration, talk-to-listen ratio). Identify both strengths AND areas for improvement per rep where the data supports it.'),
  follow_up_gaps: z.array(z.object({
    rep: z.string().describe('Rep name'),
    description: z.string().describe('Specific gap with data — e.g. "3 high-priority action items from morning calls still pending" or "heavy outbound (45 calls) but only 62% answered — consider timing"'),
  })).describe('Reps with specific follow-up risks: pending action items, low answer rates on high outbound, short call durations, or unaddressed objections.'),
  key_deals: z.array(z.object({
    contact: z.string().describe('Deal/opportunity name'),
    rep: z.string().describe('Rep who closed it'),
    status: z.string().describe('e.g. "Closed today for £1,605" — include package name and guest count if available'),
    next_steps: z.string().describe('Specific actionable next step based on the deal data — reference the package, guest count, event date proximity, payment status. Look for upsell signals (small guest count = group expansion opportunity, new business = loyalty play).'),
  })).describe('Deals closed this period with intelligent, data-driven next steps.'),
})

const MAX_RETRIES = 2

/**
 * Generate AI-powered digest insights using Gemini 3.1 Pro with structured output.
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
  dealsToday: { name: string; amount: number; owner: string; event: string; packageName: string | null; guests: number | null; isNewBusiness: boolean; accountName: string | null }[]
  upcomingEvents: { name: string; category: string | null; percentageToTarget: number | null; revenueTarget: number | null; closedWonGross: number | null }[]
  leadsCreatedToday: number
  yesterdayStats: { total_calls: number; answered_calls: number; meaningful: number } | null
  hourlyDistribution: Record<number, { inbound: number; outbound: number }>
  period: string
}): Promise<Partial<DigestPayload>> {
  const sections: string[] = []

  // Build a call_id → rep/contact name lookup from meaningful calls
  const callIdToNames = new Map<number, { agent: string; contact: string; direction: string; duration: number }>()
  for (const c of input.meaningfulCalls) {
    callIdToNames.set(c.id, { agent: c.agent_name, contact: c.contact_name, direction: c.direction, duration: c.duration })
  }

  // Section 1: Rep stats (always available)
  sections.push(`TEAM REP STATS (${input.repStats.length} reps):
${input.repStats.map(r => {
  const answerRate = r.total_calls > 0 ? Math.round((r.answered_calls / r.total_calls) * 100) : 0
  const outboundPct = r.total_calls > 0 ? Math.round((r.outbound_calls / r.total_calls) * 100) : 0
  return `- ${r.name}: ${r.total_calls} calls (${answerRate}% answered, ${outboundPct}% outbound), avg ${Math.round(r.avg_duration / 60)}min, longest ${Math.round(r.longest_call / 60)}min`
}).join('\n')}`)

  // Section 2: Call activity overview with yesterday comparison
  const answerRate = input.totalCalls > 0 ? Math.round((input.answeredCalls / input.totalCalls) * 100) : 0
  let activitySection = `CALL ACTIVITY:
- Total calls: ${input.totalCalls} (${input.answeredCalls} answered, ${answerRate}% answer rate)
- Meaningful calls (3+ min): ${input.meaningfulCalls.length}
- New leads created today: ${input.leadsCreatedToday}`

  if (input.yesterdayStats) {
    const ys = input.yesterdayStats
    const callDelta = input.totalCalls - ys.total_calls
    const callDeltaPct = ys.total_calls > 0 ? Math.round((callDelta / ys.total_calls) * 100) : 0
    const ysAnswerRate = ys.total_calls > 0 ? Math.round((ys.answered_calls / ys.total_calls) * 100) : 0
    activitySection += `\n- vs Yesterday: ${ys.total_calls} calls (${ysAnswerRate}% answered, ${ys.meaningful} meaningful) → ${callDelta >= 0 ? '+' : ''}${callDelta} calls (${callDeltaPct >= 0 ? '+' : ''}${callDeltaPct}%)`
  }

  activitySection += `\n- Meaningful call breakdown: ${input.meaningfulCalls.map(c => `${c.agent_name} <> ${c.contact_name} (${c.direction}, ${Math.round(c.duration / 60)}min)`).slice(0, 25).join('; ')}`

  sections.push(activitySection)

  // Section 3: Hourly distribution — identify patterns
  const peakHours: string[] = []
  const deadHours: string[] = []
  for (const [hourStr, counts] of Object.entries(input.hourlyDistribution)) {
    const total = counts.inbound + counts.outbound
    if (total >= 10) peakHours.push(`${hourStr}:00 (${total} calls)`)
    else if (total <= 2 && Number(hourStr) >= 9 && Number(hourStr) <= 17) deadHours.push(`${hourStr}:00 (${total} calls)`)
  }
  if (peakHours.length > 0 || deadHours.length > 0) {
    let hourlySection = 'CALL TIMING PATTERNS:'
    if (peakHours.length > 0) hourlySection += `\n- Peak hours: ${peakHours.join(', ')}`
    if (deadHours.length > 0) hourlySection += `\n- Low activity hours: ${deadHours.join(', ')}`
    sections.push(hourlySection)
  }

  // Section 4: Deals (enriched with package, guests, account, new business flag)
  if (input.dealsToday.length > 0) {
    sections.push(`DEALS CLOSED ${input.period.toUpperCase()}:
${input.dealsToday.map(d => {
  const parts = [`- ${d.name}: £${Math.round(d.amount).toLocaleString()} by ${d.owner} for ${d.event}`]
  if (d.packageName) parts.push(`  Package: ${d.packageName}`)
  if (d.guests) parts.push(`  Guests: ${d.guests}`)
  if (d.accountName) parts.push(`  Account: ${d.accountName}`)
  if (d.isNewBusiness) parts.push(`  ⭐ NEW BUSINESS`)
  return parts.join('\n')
}).join('\n')}
Total deal value: £${Math.round(input.dealsToday.reduce((s, d) => s + d.amount, 0)).toLocaleString()}`)
  }

  // Section 5: Upcoming events with ACTUAL revenue numbers (not just %)
  if (input.upcomingEvents.length > 0) {
    sections.push(`UPCOMING EVENTS — REVENUE TARGETS:
${input.upcomingEvents.slice(0, 15).map(e => {
  const parts: string[] = []
  parts.push(`- ${e.name}${e.category ? ` [${e.category}]` : ''}`)
  if (e.revenueTarget !== null && e.closedWonGross !== null) {
    const gap = e.revenueTarget - e.closedWonGross
    parts.push(`  Revenue: £${Math.round(e.closedWonGross).toLocaleString()} / £${Math.round(e.revenueTarget).toLocaleString()} (${e.percentageToTarget !== null ? Math.round(e.percentageToTarget) : '?'}%)`)
    if (gap > 0) parts.push(`  Gap to target: £${Math.round(gap).toLocaleString()}`)
  } else if (e.percentageToTarget !== null) {
    parts.push(`  ${Math.round(e.percentageToTarget)}% to target`)
  }
  return parts.join('\n')
}).join('\n')}`)
  }

  // Section 6: Cached analyses (high quality, pre-distilled)
  // NOW enriched with: rep/contact names, action items, key topics, talk-to-listen ratio
  if (input.analyses.length > 0) {
    const analysisSummaries = input.analyses.map(a => {
      // Link to rep/contact name via call_id
      const names = callIdToNames.get(a.call_id)
      const repLine = names
        ? `Rep: ${names.agent} <> ${names.contact} (${names.direction}, ${Math.round(names.duration / 60)}min)`
        : `Call ID: ${a.call_id}`

      const lines = [
        `[Analysed Call] ${repLine}`,
        `Sentiment: ${a.sentiment} (${a.sentiment_score}/100)`,
        `Summary: ${a.summary}`,
      ]

      // Key topics — trending theme signals
      if (a.key_topics && a.key_topics.length > 0) {
        lines.push(`Topics: ${a.key_topics.join(', ')}`)
      }

      lines.push(`Objections: ${a.objections.length > 0 ? a.objections.join('; ') : 'None'}`)
      lines.push(`Events: ${a.events_mentioned.length > 0 ? a.events_mentioned.map(e => typeof e === 'string' ? e : `${e.event} (${e.context})`).join(', ') : 'None'}`)
      lines.push(`Competitors: ${a.competitor_mentions.length > 0 ? a.competitor_mentions.join(', ') : 'None'}`)
      lines.push(`Opportunities: ${a.opportunity_signals.map(o => `${o.type}: ${o.description}${o.estimated_value ? ` (~${o.estimated_value})` : ''}`).join('; ') || 'None'}`)

      // Talk-to-listen ratio — key coaching metric
      if (a.talk_to_listen_ratio) {
        lines.push(`Talk/Listen: Agent ${a.talk_to_listen_ratio.agent_pct}% / Contact ${a.talk_to_listen_ratio.contact_pct}%`)
      }

      lines.push(`Coaching: ${a.coaching_notes || 'None'}`)

      // Action items — with priority and assignee
      if (a.action_items && a.action_items.length > 0) {
        lines.push(`Action Items:`)
        for (const item of a.action_items) {
          lines.push(`  [${item.priority.toUpperCase()}] ${item.description} → ${item.assignee}`)
        }
      }

      // Draft follow-up (if exists)
      if (a.draft_follow_up) {
        lines.push(`Follow-up needed: ${a.draft_follow_up.slice(0, 200)}`)
      }

      return lines.join('\n')
    })
    sections.push(`AI-ANALYSED CALL DETAILS (${input.analyses.length} calls — each has been individually analysed by AI):\n\n${analysisSummaries.join('\n\n---\n\n')}`)
  }

  // Section 7: Raw transcripts — only for calls without analysis, budget-capped
  const analysedCallIds = new Set(input.analyses.map(a => a.call_id))
  const unanalysedTranscripts = input.transcripts.filter(t => !analysedCallIds.has(t.callId))
  if (unanalysedTranscripts.length > 0) {
    // Dynamic word limit: fewer words per transcript when there are many
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
  const analysisCount = input.analyses.length
  const transcriptCount = input.transcripts.length

  // Time-of-day context
  const hour = new Date().getHours()
  const timeFrame = hour < 12 ? 'morning' : hour < 15 ? 'lunchtime' : hour < 18 ? 'afternoon' : 'end-of-day'

  const model = google('gemini-3.1-pro-preview')

  const prompt = `You are the AI sales intelligence engine for Above + Beyond, a luxury hospitality company selling premium event packages (Formula 1, The Open, Wimbledon, Six Nations, Cheltenham, Ryder Cup, Harry Styles, Oscars, etc.).

You're generating the ${input.period} team digest at ${timeFrame} (${hour}:00). This is shown to the WHOLE COMPANY on a sales floor screen. Make it sharp, specific, and energising.

${timeFrame === 'morning' ? 'FRAMING: This is the morning briefing — set the energy, highlight what to focus on today, flag any urgent follow-ups from yesterday.' : timeFrame === 'lunchtime' ? 'FRAMING: This is the lunchtime pulse check — celebrate wins so far, flag what needs attention this afternoon, keep momentum high.' : 'FRAMING: This is the end-of-day debrief — celebrate the day, call out standout performances, set up tomorrow.'}

DATA:
${sections.join('\n\n')}

DATA QUALITY: ${analysisCount} AI-analysed calls (rich data with sentiment, objections, action items, talk ratios), ${transcriptCount} raw transcripts, ${input.repStats.length} reps tracked.${!hasDeepData ? ' ⚠️ No transcript or analysis data available — work only from call stats and deal data. Do not fabricate conversation insights.' : ''}

INSTRUCTIONS:
- team_summary: 3-5 sentences. Lead with energy.${input.yesterdayStats ? ' Reference the vs-yesterday comparison.' : ''} Cover call volume, answer rate, meaningful conversations, name top performers, deal momentum.${hasDeepData ? ' Weave in key conversation themes from the analysed data.' : ''} Mention new leads if > 0.
- top_objections: Pull ONLY from actual transcript/analysis data — never fabricate.${!hasDeepData ? ' Return empty array — no conversation data available.' : ''} Suggested responses should be something a rep can say verbatim on a call.
- winning_pitches: What specific techniques worked? Name the rep and context.${!hasDeepData ? ' Return empty array — no conversation data available.' : ''}
- event_demand: Cross-reference call mentions with the revenue target data. USE THE ACTUAL £ FIGURES — "£15K gap to £50K target" is much more actionable than "65% to target". Flag HOT (high demand + on track), CAUTION (behind target), CRITICAL (far behind + low activity). Include ALL upcoming events, even those with 0 mentions — if they have a revenue gap, that silence IS the signal.
- competitor_intelligence: Specific intelligence only.${!hasDeepData ? ' Return empty array.' : ''} What are clients saying about pricing, quality, availability?
- coaching_highlights: Analyse EVERY rep. Use their exact stats — answer rate, outbound %, avg duration. When talk-to-listen ratios are available, reference them ("Aaron talked 72% of the time — try to bring that under 60%"). When action items are pending, flag them.
- follow_up_gaps: Reference specific pending action items, timing patterns (dead hours = missed opportunity), and answer rate issues. Be data-driven, not generic.
- key_deals: For each closed deal, reference the package name, guest count, account, and new business flag to drive next steps. Small guest counts = group upsell. New business = "send welcome pack, book relationship call". Returning client = "check account credit, suggest add-ons".
- EVERY insight must tell the team what to DO. No filler, no corporate speak.
- Return empty arrays ONLY for categories with genuinely zero relevant data.`

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

    // Fetch all data sources in parallel (including yesterday's stats for comparison)
    const [{ data: callData }, recap, recentTranscripts, yesterdayStats] = await Promise.all([
      getCallDashboardData(period),
      generateEventRecap(false),
      getRecentTranscripts(100),
      getYesterdayStats(redis),
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

    console.log(`Digest: ${cachedAnalyses.length} cached analyses, ${transcriptData.length} transcripts, ${callData.analysableCalls.length} meaningful calls, ${callData.stats.total_calls} total calls${yesterdayStats ? `, yesterday: ${yesterdayStats.total_calls} calls` : ''}`)

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
        packageName: d.packageName,
        guests: d.guests,
        isNewBusiness: d.isNewBusiness,
        accountName: d.accountName,
      })),
      upcomingEvents: recap.upcomingEvents.map(e => ({
        name: e.name,
        category: e.category,
        percentageToTarget: e.percentageToTarget,
        revenueTarget: e.revenueTarget,
        closedWonGross: e.closedWonGross,
      })),
      leadsCreatedToday: recap.leadsCreatedToday,
      yesterdayStats,
      hourlyDistribution: callData.hourlyDistribution,
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
