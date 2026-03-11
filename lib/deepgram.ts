// Deepgram Nova-3 transcription — URL-based, no file upload needed
// Replaces OpenAI Whisper which fails on Vercel due to 4.5MB body limit

import { DeepgramClient } from '@deepgram/sdk'

function getClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    throw new Error('Missing DEEPGRAM_API_KEY environment variable')
  }
  return new DeepgramClient({ apiKey })
}

export interface TranscriptionResult {
  transcript: string
  speakerCount: number
  durationSeconds: number
}

/**
 * Transcribe an audio file from a URL using Deepgram Nova-3.
 * Uses speaker diarization to identify agent vs contact.
 * Recording URLs (e.g. from Aircall) are publicly accessible — Deepgram fetches them directly.
 *
 * @param recordingUrl - Public URL to the audio file (MP3)
 * @param agentName - Name of the sales rep
 * @param contactName - Name of the client/prospect
 * @param direction - Call direction, used to infer which speaker is the agent
 */
export async function transcribeFromUrl(
  recordingUrl: string,
  agentName: string,
  contactName: string,
  direction: 'inbound' | 'outbound'
): Promise<TranscriptionResult> {
  const MAX_RETRIES = 2

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = attempt * 3000
        console.log(`Deepgram retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      return await doTranscribe(recordingUrl, agentName, contactName, direction)
    } catch (err) {
      const errMsg = (err as Error).message || ''
      const isRetryable =
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('timeout') ||
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('socket hang up') ||
        errMsg.includes('fetch failed') ||
        errMsg.includes('502') ||
        errMsg.includes('503')

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err
      }
      console.warn(`Deepgram transient error (attempt ${attempt + 1}): ${errMsg}`)
    }
  }

  throw new Error('Deepgram transcription failed after retries')
}

async function doTranscribe(
  recordingUrl: string,
  agentName: string,
  contactName: string,
  direction: 'inbound' | 'outbound'
): Promise<TranscriptionResult> {
  const deepgram = getClient()

  // SDK v5: transcribeUrl takes a single flat object with url + all options
  // Returns ListenV1Response | ListenV1AcceptedResponse (union type)
  const response = await deepgram.listen.v1.media.transcribeUrl({
    url: recordingUrl,
    model: 'nova-3',
    language: 'en',
    smart_format: true,
    diarize: true,
    utterances: true,
    punctuate: true,
  })

  // Narrow type: async callback responses only have request_id
  if (!('results' in response)) {
    throw new Error('Deepgram returned async response instead of transcription result')
  }

  const utterances = response.results?.utterances
  const durationSeconds = response.metadata?.duration || 0

  if (!utterances || utterances.length === 0) {
    // Fall back to flat transcript if utterances not available
    const channels = response.results?.channels
    const flatTranscript = channels && channels.length > 0
      ? channels[0]?.alternatives?.[0]?.transcript
      : undefined
    if (!flatTranscript) {
      throw new Error('Deepgram returned empty transcript')
    }
    return {
      transcript: flatTranscript,
      speakerCount: 1,
      durationSeconds,
    }
  }

  // Determine speaker mapping: which speaker ID is the agent?
  // Heuristic: in outbound calls the agent (caller) typically speaks first,
  // in inbound calls the contact (caller) typically speaks first.
  const firstSpeaker = utterances[0].speaker ?? 0
  const agentSpeakerId = direction === 'outbound' ? firstSpeaker : (firstSpeaker === 0 ? 1 : 0)

  // Count unique speakers
  const speakerIds = new Set(utterances.map(u => u.speaker))
  const speakerCount = speakerIds.size

  // Format transcript with timestamps and speaker names
  type Utterance = NonNullable<typeof utterances>[number]
  const lines = utterances.map((u: Utterance) => {
    const startSecs = u.start ?? 0
    const mins = Math.floor(startSecs / 60)
    const secs = Math.floor(startSecs % 60)
    const time = `${mins}:${secs.toString().padStart(2, '0')}`

    const speaker = u.speaker === agentSpeakerId ? agentName : contactName
    return `[${time}] ${speaker}: ${u.transcript}`
  })

  return {
    transcript: lines.join('\n'),
    speakerCount,
    durationSeconds,
  }
}
