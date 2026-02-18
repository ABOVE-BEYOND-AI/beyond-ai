// AI-powered call analysis using Claude Sonnet 4.6
// Analyses individual call transcripts and generates team-wide daily digests

import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

const MODEL = 'claude-sonnet-4-20250514'

// ── Types ──

export interface CallAnalysis {
  call_id: number
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  sentiment_score: number // 0-100 (100 = very positive)
  key_topics: string[]
  objections: string[]
  action_items: {
    description: string
    assignee: string
    priority: 'high' | 'medium' | 'low'
  }[]
  opportunity_signals: {
    type: 'new_deal' | 'upsell' | 'follow_up' | 'at_risk' | 'closed_lost'
    description: string
    estimated_value?: string
  }[]
  competitor_mentions: string[]
  events_mentioned: string[]
  talk_to_listen_ratio: {
    agent_pct: number
    contact_pct: number
  }
  coaching_notes: string | null
  draft_follow_up: string | null
  analysed_at: string
}

export interface DailyDigest {
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

// ── Individual Call Analysis ──

export async function analyseCall(params: {
  transcript: string
  agentName: string
  contactName: string
  duration: number
  direction: 'inbound' | 'outbound'
  callId: number
}): Promise<CallAnalysis> {
  const anthropic = getClient()

  const durationMins = Math.floor(params.duration / 60)
  const durationSecs = params.duration % 60

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert sales intelligence analyst for a luxury hospitality company called Above + Beyond. The company sells premium event hospitality packages — Grand Prix, The Open Championship, Wimbledon, Six Nations, and similar high-end sporting events. Clients are typically corporate executives and high-net-worth individuals.

Analyse this ${params.direction} sales call between ${params.agentName} (sales rep) and ${params.contactName} (prospect/client). Duration: ${durationMins}m ${durationSecs}s.

TRANSCRIPT:
${params.transcript}

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence summary of the call — what was discussed, what was the outcome, what happens next",
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "sentiment_score": 0-100 (100 = very positive),
  "key_topics": ["topic1", "topic2", ...],
  "objections": ["any pricing objections, timing concerns, competitor comparisons, or hesitations expressed by the prospect"],
  "action_items": [
    { "description": "what needs to be done", "assignee": "who should do it", "priority": "high|medium|low" }
  ],
  "opportunity_signals": [
    { "type": "new_deal|upsell|follow_up|at_risk|closed_lost", "description": "what the opportunity is", "estimated_value": "optional £ estimate" }
  ],
  "competitor_mentions": ["any competitors or alternative providers mentioned"],
  "events_mentioned": ["specific events discussed — e.g. 'The Open St Andrews 2027', 'Madrid Grand Prix 2026'"],
  "talk_to_listen_ratio": { "agent_pct": 60, "contact_pct": 40 },
  "coaching_notes": "brief coaching observation for the sales rep if applicable — what they did well or could improve. null if nothing notable",
  "draft_follow_up": "a brief professional follow-up email the rep could send after this call. null if not appropriate"
}

Important:
- Be specific — reference actual names, events, and amounts mentioned in the call
- For objections, capture the exact concern even if it was handled well
- For action items, be specific about what needs doing and by when if mentioned
- For coaching, be constructive — highlight both strengths and areas for improvement
- The draft follow-up should be concise, professional, and reference specific discussion points
- Return ONLY valid JSON, no markdown or explanation`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Parse JSON, handling potential markdown wrapping
  let jsonStr = content.text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const analysis = JSON.parse(jsonStr)

  return {
    call_id: params.callId,
    ...analysis,
    analysed_at: new Date().toISOString(),
  }
}

// ── Team Daily Digest ──

export async function generateDailyDigest(params: {
  analyses: CallAnalysis[]
  repNames: string[]
  period: string // e.g. "Morning (9am-12:30pm)" or "Full Day"
}): Promise<DailyDigest> {
  const anthropic = getClient()

  // Build a summary of all analysed calls
  const callSummaries = params.analyses.map((a, i) => {
    return `Call ${i + 1} (ID: ${a.call_id}):
Summary: ${a.summary}
Sentiment: ${a.sentiment} (${a.sentiment_score}/100)
Topics: ${a.key_topics.join(', ')}
Objections: ${a.objections.length > 0 ? a.objections.join('; ') : 'None'}
Events: ${a.events_mentioned.length > 0 ? a.events_mentioned.join(', ') : 'None'}
Competitors: ${a.competitor_mentions.length > 0 ? a.competitor_mentions.join(', ') : 'None'}
Action Items: ${a.action_items.map(ai => `${ai.description} (${ai.assignee})`).join('; ') || 'None'}
Opportunity: ${a.opportunity_signals.map(o => `${o.type}: ${o.description}`).join('; ') || 'None'}`
  })

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 6144,
    messages: [
      {
        role: 'user',
        content: `You are the AI sales intelligence engine for Above + Beyond, a luxury hospitality company selling premium event packages (Grand Prix, The Open, Wimbledon, Six Nations, etc.). You're generating the ${params.period} team digest.

Team members: ${params.repNames.join(', ')}

Here are the analysed calls from this period (${params.analyses.length} calls total):

${callSummaries.join('\n\n---\n\n')}

Generate a comprehensive team intelligence digest as JSON:
{
  "team_summary": "3-4 sentence executive summary of the period's activity — tone, volume, key outcomes, overall sentiment",
  "top_objections": [
    { "objection": "the specific objection pattern", "frequency": 3, "suggested_response": "how reps should handle this" }
  ],
  "winning_pitches": [
    { "description": "what pitch or approach worked well", "rep": "who did it", "context": "brief context of the call" }
  ],
  "event_demand": [
    { "event": "event name", "mentions": 5, "sentiment": "brief note on demand sentiment" }
  ],
  "competitor_intelligence": [
    { "competitor": "name", "mentions": 2, "context": "what was said about them" }
  ],
  "follow_up_gaps": [
    { "rep": "name", "description": "what follow-up might be missing or at risk" }
  ],
  "coaching_highlights": [
    { "rep": "name", "type": "strength|improvement", "description": "specific coaching observation" }
  ],
  "key_deals": [
    { "contact": "client name", "rep": "rep name", "status": "where the deal stands", "next_steps": "what needs to happen" }
  ]
}

Guidelines:
- Be actionable — every insight should tell the team what to DO about it
- Aggregate patterns — don't just list individual calls, find the patterns
- Be specific with numbers, names, and events
- For objections, provide practical suggested responses tailored to luxury hospitality
- For coaching, be constructive and highlight positives alongside improvements
- If there aren't enough calls to identify patterns, say so honestly
- Return ONLY valid JSON`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  let jsonStr = content.text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const digest = JSON.parse(jsonStr)

  return {
    period: params.period,
    generated_at: new Date().toISOString(),
    total_calls_analysed: params.analyses.length,
    ...digest,
  }
}
