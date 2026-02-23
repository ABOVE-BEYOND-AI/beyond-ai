// Gmail API client for sending emails and reading threads

// ── Types ──

export interface SendEmailParams {
  to: string
  subject: string
  htmlBody: string
  replyTo?: string
}

export interface SendEmailResult {
  id: string
  threadId: string
  labelIds: string[]
}

export interface GmailThread {
  id: string
  historyId: string
  messages: GmailMessage[]
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: { name: string; value: string }[]
    mimeType: string
    body?: { size: number; data?: string }
  }
  internalDate: string
}

// ── Helpers ──

/**
 * Base64url encode a string (RFC 4648 Section 5).
 * Uses Node Buffer which is available in Next.js API routes.
 */
function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Build a properly formatted MIME message and return it base64url-encoded.
 */
export function buildMimeMessage(
  to: string,
  subject: string,
  body: string,
  replyTo?: string
): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]

  if (replyTo) {
    headers.push(`Reply-To: ${replyTo}`)
  }

  // Plain text fallback — strip HTML tags
  const plainText = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .trim()

  const mimeBody = [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    plainText,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    body,
    `--${boundary}--`,
  ].join('\r\n')

  return base64urlEncode(mimeBody)
}

// ── API Functions ──

/**
 * Send an email via the Gmail API.
 * Requires an access token with the `gmail.send` scope.
 */
export async function sendEmail(
  accessToken: string,
  params: SendEmailParams
): Promise<SendEmailResult> {
  const raw = buildMimeMessage(
    params.to,
    params.subject,
    params.htmlBody,
    params.replyTo
  )

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gmail send failed:', response.status, errorText)
    throw new Error(`Gmail send failed (${response.status}): ${errorText}`)
  }

  const result = await response.json()

  return {
    id: result.id,
    threadId: result.threadId,
    labelIds: result.labelIds || [],
  }
}

/**
 * Fetch a Gmail thread by ID to check for replies.
 * Requires an access token with gmail.readonly or gmail.modify scope.
 */
export async function getThread(
  accessToken: string,
  threadId: string
): Promise<GmailThread> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gmail getThread failed:', response.status, errorText)
    throw new Error(`Gmail getThread failed (${response.status}): ${errorText}`)
  }

  return response.json()
}
